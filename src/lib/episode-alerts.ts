import "server-only";
import { anilistRequest } from "@/lib/anilist/client";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/env";

/**
 * Avisos de episodios nuevos.
 * Lo ejecuta un cron de la VPS cada 30 min (POST /api/cron/episodes):
 *  1. Pide a AniList los episodios emitidos en la última ventana.
 *  2. Crea una notificación (kind "system", payload.type "new_episode") a cada usuario que
 *     tiene ese anime en Viendo / Planeado / Re-viendo, sin duplicar (payload.key).
 *  3. Si existe DISCORD_EPISODES_WEBHOOK_URL, publica los estrenos más populares en Discord.
 */

const AIRED_QUERY = /* GraphQL */ `
  query Aired($from: Int, $to: Int, $page: Int) {
    Page(page: $page, perPage: 50) {
      pageInfo { hasNextPage }
      airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
        episode
        airingAt
        media {
          id
          isAdult
          popularity
          countryOfOrigin
          episodes
          title { romaji english }
          coverImage { large color }
          siteUrl
        }
      }
    }
  }
`;

type Aired = {
  episode: number;
  airingAt: number;
  media: {
    id: number;
    isAdult: boolean;
    popularity: number | null;
    countryOfOrigin: string | null;
    episodes: number | null;
    title: { romaji: string | null; english: string | null };
    coverImage: { large: string | null; color: string | null };
  } | null;
};

export type EpisodeAlertsResult = { aired: number; notified: number; skippedDuplicates: number; discordPosted: number; errors: string[]; dryRun: boolean; sample: string[] };

const FOLLOWING = ["CURRENT", "PLANNING", "REPEATING"];
/** Popularidad mínima en AniList para anunciarlo en Discord (evita spam de series muy nicho). */
const DISCORD_MIN_POPULARITY = 15000;

const titleOf = (m: NonNullable<Aired["media"]>) => m.title.english || m.title.romaji || `Anime ${m.id}`;

export async function fetchAiredEpisodes(fromSec: number, toSec: number): Promise<Aired[]> {
  const out: Aired[] = [];
  for (let page = 1; page <= 6; page++) {
    const d = await anilistRequest<{ Page: { pageInfo: { hasNextPage: boolean }; airingSchedules: Aired[] } }>(
      AIRED_QUERY,
      { from: fromSec, to: toSec, page },
      { persist: false },
    );
    out.push(...d.Page.airingSchedules.filter((a) => a.media && !a.media.isAdult));
    if (!d.Page.pageInfo.hasNextPage) break;
  }
  return out;
}

export async function runEpisodeAlerts({ windowMinutes = 75, now = Date.now(), dryRun = false } = {}): Promise<EpisodeAlertsResult> {
  const result: EpisodeAlertsResult = { aired: 0, notified: 0, skippedDuplicates: 0, discordPosted: 0, errors: [], dryRun, sample: [] };
  const db = getSupabaseAdmin();
  if (!db) {
    result.errors.push("Supabase admin no configurado");
    return result;
  }
  const to = Math.floor(now / 1000);
  const aired = await fetchAiredEpisodes(to - windowMinutes * 60, to);
  result.aired = aired.length;
  if (!aired.length) return result;

  const byMedia = new Map<number, Aired>();
  for (const a of aired) byMedia.set(a.media!.id, a); // si salen 2 episodios seguidos, se avisa del último

  // Usuarios que siguen esos animes
  const { data: followers, error } = await db
    .from("anime_library_entries")
    .select("user_id, media_id")
    .in("media_id", [...byMedia.keys()])
    .in("status", FOLLOWING)
    .limit(10000);
  if (error) result.errors.push(`library: ${error.message}`);

  const rows = (followers ?? []).map((f: { user_id: string; media_id: number }) => {
    const a = byMedia.get(f.media_id)!;
    const m = a.media!;
    const key = `ep:${m.id}:${a.episode}`;
    return {
      user_id: f.user_id,
      kind: "system",
      payload: {
        type: "new_episode",
        key,
        message: `Nuevo episodio: ${titleOf(m)} · Ep. ${a.episode}`,
        href: `/watch/${m.id}/${a.episode}`,
        media_id: String(m.id),
        episode: String(a.episode),
        cover: m.coverImage.large ?? "",
      },
    };
  });

  if (rows.length) {
    // Evitar duplicados si el cron se solapa: ¿qué avisos con esas claves ya existen?
    const keys = [...new Set(rows.map((r) => r.payload.key))];
    const { data: existing } = await db
      .from("notifications")
      .select("user_id, payload->>key")
      .eq("kind", "system")
      .in("payload->>key", keys)
      .limit(20000);
    const seen = new Set((existing ?? []).map((e: Record<string, string>) => `${e.user_id}|${e.key}`));
    const fresh = rows.filter((r) => !seen.has(`${r.user_id}|${r.payload.key}`));
    result.skippedDuplicates = rows.length - fresh.length;
    result.sample = [...new Set(fresh.map((r) => r.payload.message))].slice(0, 5);
    if (dryRun) {
      result.notified = fresh.length; // se enviarían
      return result;
    }
    for (let i = 0; i < fresh.length; i += 500) {
      const { error: insErr } = await db.from("notifications").insert(fresh.slice(i, i + 500));
      if (insErr) result.errors.push(`insert: ${insErr.message}`);
      else result.notified += Math.min(500, fresh.length - i);
    }
  }

  if (dryRun) return result; // en modo prueba nunca se publica en Discord
  result.discordPosted = await postToDiscord([...byMedia.values()]).catch((e: Error) => {
    result.errors.push(`discord: ${e.message}`);
    return 0;
  });
  return result;
}

/** Publica en un canal de Discord (webhook) los estrenos más populares de la ventana. */
async function postToDiscord(aired: Aired[]): Promise<number> {
  const url = process.env.DISCORD_EPISODES_WEBHOOK_URL;
  if (!url) return 0;
  const picks = aired
    .filter((a) => (a.media!.popularity ?? 0) >= DISCORD_MIN_POPULARITY && (a.media!.countryOfOrigin ?? "JP") === "JP")
    .sort((a, b) => (b.media!.popularity ?? 0) - (a.media!.popularity ?? 0))
    .slice(0, 10);
  if (!picks.length) return 0;
  const base = new URL(siteUrl).origin;
  const embeds = picks.map((a) => {
    const m = a.media!;
    const color = m.coverImage.color ? Number.parseInt(m.coverImage.color.slice(1), 16) : 0xa855f7;
    return {
      title: `${titleOf(m)} · Episodio ${a.episode}${m.episodes ? `/${m.episodes}` : ""}`,
      url: `${base}/watch/${m.id}/${a.episode}`,
      description: "¡Nuevo episodio disponible! Míralo en KAZE 🍿",
      color,
      thumbnail: m.coverImage.large ? { url: m.coverImage.large } : undefined,
      timestamp: new Date(a.airingAt * 1000).toISOString(),
    };
  });
  // Discord admite hasta 10 embeds por mensaje.
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "KAZE Estrenos", content: "📺 **Nuevos episodios**", embeds }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return picks.length;
}
