import { ImageResponse } from "next/og";
import { getMediaDetail } from "@/lib/anilist/service";
import { genreLabel } from "@/lib/anilist/browse-params";

/**
 * Tarjeta para compartir (Discord, WhatsApp, X, Facebook…) de cada ficha de anime.
 * 1200×630 con portada, título, datos y marca KAZE. Se genera una vez y queda en caché
 * (getMediaDetail usa cacheLife("days") y Cloudflare cachea /anime/*).
 */
export const alt = "Ver anime online en KAZE";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#080810";
const PRIMARY = "#a855f7";
const ACCENT = "#ff4fd8";
const TEXT = "#f7f5ff";
const MUTED = "#b8b3cc";

const FORMAT: Record<string, string> = {
  TV: "Serie",
  TV_SHORT: "Serie corta",
  MOVIE: "Película",
  SPECIAL: "Especial",
  OVA: "OVA",
  ONA: "ONA",
  MUSIC: "Musical",
};

function truncate(s: string, max: number) {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

function Brand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: `linear-gradient(135deg, ${PRIMARY}, ${ACCENT})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 26,
          fontWeight: 800,
        }}
      >
        K
      </div>
      <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: TEXT, letterSpacing: 4 }}>KAZE</div>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number.parseInt(idParam, 10);
  const media = Number.isInteger(id) && id > 0 ? await getMediaDetail(id).catch(() => null) : null;

  // Sin datos (id inválido, adulto o AniList caído): tarjeta genérica de la marca.
  if (!media || media.isAdult) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: 24,
            background: `radial-gradient(circle at 30% 20%, #2a1450, ${BG} 60%)`,
          }}
        >
          <Brand />
          <div style={{ display: "flex", fontSize: 44, color: TEXT, fontWeight: 700 }}>Anime online en español</div>
          <div style={{ display: "flex", fontSize: 26, color: MUTED }}>www.orunei.sbs</div>
        </div>
      ),
      size,
    );
  }

  const title = truncate(media.title.english || media.title.romaji || "Anime", 70);
  const subtitle = media.title.english && media.title.romaji && media.title.romaji !== media.title.english ? truncate(media.title.romaji, 60) : null;
  const accent = media.coverImage.color || PRIMARY;
  const cover = media.coverImage.extraLarge || media.coverImage.large;
  const meta = [
    media.format ? FORMAT[media.format] ?? media.format : null,
    media.seasonYear ? String(media.seasonYear) : null,
    media.episodes ? `${media.episodes} episodios` : null,
  ].filter(Boolean) as string[];
  const genres = (media.genres ?? []).slice(0, 3).map(genreLabel);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: BG }}>
        {/* Fondo: banner oscurecido */}
        {media.bannerImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.bannerImage} alt="" width={1200} height={630} style={{ position: "absolute", inset: 0, width: 1200, height: 630, objectFit: "cover", opacity: 0.35 }} />
        ) : null}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background: `linear-gradient(90deg, ${BG} 0%, rgba(8,8,16,0.92) 45%, rgba(8,8,16,0.55) 100%)`,
          }}
        />

        <div style={{ position: "relative", display: "flex", width: "100%", height: "100%", padding: 56, gap: 52, alignItems: "center" }}>
          {/* Portada */}
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt=""
              width={340}
              height={490}
              style={{ width: 340, height: 490, objectFit: "cover", borderRadius: 24, border: `4px solid ${accent}`, boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}
            />
          ) : null}

          {/* Texto */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, height: 490, justifyContent: "space-between" }}>
            <Brand />

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", fontSize: title.length > 40 ? 52 : 64, fontWeight: 800, color: TEXT, lineHeight: 1.08 }}>{title}</div>
              {subtitle ? <div style={{ display: "flex", fontSize: 26, color: MUTED }}>{subtitle}</div> : null}
              {meta.length ? <div style={{ display: "flex", fontSize: 26, color: MUTED }}>{meta.join("  ·  ")}</div> : null}
              {genres.length ? (
                <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                  {genres.map((g) => (
                    <div key={g} style={{ display: "flex", padding: "8px 18px", borderRadius: 999, background: "rgba(168,85,247,0.18)", border: `2px solid ${PRIMARY}`, color: TEXT, fontSize: 22 }}>
                      {g}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div
                style={{
                  display: "flex",
                  padding: "14px 28px",
                  borderRadius: 16,
                  background: `linear-gradient(135deg, ${PRIMARY}, ${ACCENT})`,
                  color: "#fff",
                  fontSize: 26,
                  fontWeight: 700,
                }}
              >
                Ver gratis en español
              </div>
              {media.averageScore ? (
                <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: TEXT }}>{`${(media.averageScore / 10).toFixed(1)} / 10`}</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
