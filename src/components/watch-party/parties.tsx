"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Film, Play, Popcorn, Radio, Search, Sparkles, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useAuth } from "@/stores/auth";
import { useLibrary } from "@/stores/library";
import { api } from "@/lib/api-client";
import { useDebounced, useNow } from "@/lib/hooks";
import { AuthGate } from "@/components/social/gate";
import { EmptyState, SafeImage, Skeleton } from "@/components/ui/primitives";
import { relativeTime } from "@/lib/utils";

type RoomRow = {
  id: string;
  title: string;
  series_id: string;
  episode_id: string;
  host_id: string;
  is_playing: boolean;
  created_at: string;
  ended_at: string | null;
  host?: { username: string; display_name: string } | null;
};

type AnimeChoice = {
  id: string;
  title: string;
  episodes: number;
  cover?: string | null;
};

const POPULAR_ANIME: AnimeChoice[] = [
  { id: "113415", title: "Jujutsu Kaisen", episodes: 24, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx113415-bbBWj4hGeEvaluate.png" },
  { id: "127230", title: "Chainsaw Man", episodes: 12, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx127230-NuLLd4twcNm8.png" },
  { id: "171018", title: "Dan Da Dan", episodes: 12, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx171018-80H5c4XW7B8u.jpg" },
  { id: "154587", title: "Frieren: Beyond Journey's End", episodes: 28, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-nOpnSNjOHQE0.jpg" },
  { id: "151807", title: "Solo Leveling", episodes: 12, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-3w5N9jJk2H6n.jpg" },
  { id: "101922", title: "Demon Slayer: Kimetsu no Yaiba", episodes: 26, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101922-PEn1CTDYwgvr.jpg" },
  { id: "150672", title: "Oshi no Ko", episodes: 11, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx150672-3yqN5n5f2c5j.jpg" },
  { id: "16498", title: "Attack on Titan", episodes: 25, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-m5ZMN7RiSE2v.jpg" },
  { id: "21", title: "One Piece", episodes: 1120, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21-YCDoj1EkASI2.jpg" },
  { id: "140960", title: "SPY x FAMILY", episodes: 25, cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx140960-mooCL5cfNU8M.jpg" },
];

export function WatchPartiesIndex() {
  return (
    <AuthGate feature="watch parties" jp="宴">
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const me = useAuth((s) => s.user?.id) || "guest";
  const myProfile = useAuth((s) => s.profile);
  const libraryEntries = useLibrary((s) => s.entries);
  const sp = useSearchParams();
  const router = useRouter();
  const now = useNow();

  // 1. Extraer animes de la biblioteca del usuario
  const libraryAnime: AnimeChoice[] = useMemo(() => {
    return Object.values(libraryEntries).map((e) => ({
      id: String(e.mediaId),
      title: e.media.title,
      episodes: e.media.episodes ?? 24,
      cover: e.media.cover ?? null,
    }));
  }, [libraryEntries]);

  // Lista combinada de opciones iniciales
  const baseChoices: AnimeChoice[] = useMemo(() => {
    const list: AnimeChoice[] = [...libraryAnime];
    for (const pop of POPULAR_ANIME) {
      if (!list.some((a) => a.id === pop.id)) {
        list.push(pop);
      }
    }
    return list;
  }, [libraryAnime]);

  // Búsqueda en vivo de anime adicional en AniList
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounced(searchQuery.trim(), 350);
  const { data: searchResults } = useQuery({
    queryKey: ["anime-suggest", debouncedSearch],
    queryFn: () => api.suggest(debouncedSearch),
    enabled: debouncedSearch.length >= 2,
    staleTime: 5 * 60_000,
  });

  const searchedAnime: AnimeChoice[] = useMemo(() => {
    if (!searchResults?.results?.length) return [];
    return searchResults.results.map((r) => {
      const t = typeof r.title === "string" ? r.title : r.title.english || r.title.romaji || "Anime";
      return {
        id: String(r.id),
        title: t,
        episodes: 24,
        cover: r.coverImage?.large ?? null,
      };
    });
  }, [searchResults]);

  // Lista total disponible
  const allChoices = useMemo(() => {
    if (searchedAnime.length) return searchedAnime;
    return baseChoices;
  }, [searchedAnime, baseChoices]);

  // Estado del anime seleccionado
  const initialSeriesId = sp.get("series") ?? allChoices[0]?.id ?? "113415";
  const [selectedSeriesId, setSelectedSeriesId] = useState(initialSeriesId);
  const selectedAnime = useMemo(() => {
    return allChoices.find((a) => a.id === selectedSeriesId) ?? allChoices[0] ?? POPULAR_ANIME[0];
  }, [allChoices, selectedSeriesId]);

  const [title, setTitle] = useState(`Noche de anime · ${selectedAnime.title}`);
  const [episode, setEpisode] = useState(sp.get("episode") ?? "1");
  const [inviteOnly, setInviteOnly] = useState(false);
  const [busy, setBusy] = useState(false);

  // Actualizar título sugerido cuando cambia el anime
  useEffect(() => {
    if (selectedAnime) {
      setTitle(`Noche de anime · ${selectedAnime.title}`);
      setEpisode("1");
    }
  }, [selectedAnime]);

  // 2. Consulta blindada de salas activas (sin errores ni toasts si no existe la tabla)
  const rooms = useQuery({
    queryKey: ["rooms", me],
    queryFn: async () => {
      let remoteRooms: RoomRow[] = [];
      try {
        const db = getSupabaseBrowser();
        if (db) {
          const { data, error } = await db
            .from("watch_party_rooms")
            .select("id, title, series_id, episode_id, host_id, is_playing, created_at, ended_at, host:profiles!watch_party_rooms_host_id_fkey(username, display_name)")
            .is("ended_at", null)
            .order("created_at", { ascending: false })
            .limit(30);
          if (!error && data) remoteRooms = data as unknown as RoomRow[];
          if (error) console.warn("[kaze] remote rooms fetch error:", error);
        }
      } catch {}

      let localRooms: RoomRow[] = [];
      try {
        const raw = localStorage.getItem("kaze:watch_party_rooms");
        if (raw) {
          localRooms = (JSON.parse(raw) as RoomRow[]).filter((r) => !r.ended_at);
        }
      } catch {}

      const all = [...localRooms, ...remoteRooms];
      const seen = new Set<string>();
      return all.filter((r) => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      });
    },
    refetchInterval: 30_000,
  });

  // 3. Crear sala con compatibilidad híbrida (Supabase + Local)
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    const roomId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `wp-${Date.now()}`;
    const roomPayload: RoomRow = {
      id: roomId,
      host_id: me,
      title: title.trim().slice(0, 80) || `Sala · ${selectedAnime.title}`,
      series_id: selectedAnime.id,
      episode_id: episode,
      is_playing: false,
      created_at: new Date().toISOString(),
      ended_at: null,
      host: {
        username: myProfile?.username || "tú",
        display_name: myProfile?.display_name || "Tú",
      },
    };

    // Intentar persistir en Supabase de forma segura
    try {
      const db = getSupabaseBrowser();
      if (db) {
        const { error: roomErr } = await db.from("watch_party_rooms").insert({
          id: roomId,
          host_id: me,
          title: roomPayload.title,
          series_id: roomPayload.series_id,
          episode_id: roomPayload.episode_id,
          invite_only: inviteOnly,
        });
        if (roomErr) console.warn("[kaze] room insert error:", roomErr);

        await db.from("watch_party_participants").upsert({
          room_id: roomId,
          user_id: me,
          role: "host",
          left_at: null,
        }, { onConflict: "room_id,user_id" });
      }
    } catch {}

    // Guardar en localStorage para disponibilidad inmediata
    try {
      const raw = localStorage.getItem("kaze:watch_party_rooms");
      const list = raw ? JSON.parse(raw) : [];
      localStorage.setItem("kaze:watch_party_rooms", JSON.stringify([roomPayload, ...list.slice(0, 20)]));
    } catch {}

    setBusy(false);
    toast.success("Sala de cine creada");
    router.push(`/watch-parties/${roomId}`);
  };

  const maxEpisodes = Math.min(selectedAnime.episodes || 24, 60);

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[440px_1fr]">
      {/* Formulario de Creación de Sala */}
      <form onSubmit={create} className="k-card space-y-5 self-start p-6 shadow-xl border border-line">
        <p className="flex items-center gap-2 font-display text-xl font-bold text-fg">
          <Popcorn className="size-6 text-primary" aria-hidden /> Crear sala de cine
        </p>

        {/* Nombre de la Sala */}
        <div>
          <label htmlFor="wp-title" className="mb-1.5 block text-sm font-semibold">
            Nombre de la sala
          </label>
          <input
            id="wp-title"
            className="k-input w-full"
            maxLength={80}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Maratón con amigos..."
          />
        </div>

        {/* Buscador de Anime en tiempo real */}
        <div>
          <label htmlFor="anime-search" className="mb-1.5 block text-sm font-semibold">
            Buscar anime en el catálogo
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              id="anime-search"
              className="k-input w-full !pl-9 text-xs"
              placeholder="Escribe el nombre de cualquier anime..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Selector de Anime */}
        <div>
          <label htmlFor="wp-series" className="mb-1.5 block text-sm font-semibold">
            Anime a reproducir
          </label>
          <select
            id="wp-series"
            className="k-input w-full text-sm font-medium"
            value={selectedSeriesId}
            onChange={(e) => setSelectedSeriesId(e.target.value)}
          >
            {libraryAnime.length > 0 && !searchQuery && (
              <optgroup label="De tu biblioteca">
                {libraryAnime.map((a) => (
                  <option key={`lib-${a.id}`} value={a.id}>
                    ★ {a.title}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label={searchQuery ? "Resultados de búsqueda" : "Populares & En emisión"}>
              {allChoices.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Selector de Episodio */}
        <div>
          <label htmlFor="wp-ep" className="mb-1.5 block text-sm font-semibold">
            Episodio inicial
          </label>
          <div className="flex gap-2 items-center">
            <select
              id="wp-ep"
              className="k-input flex-1 text-sm"
              value={episode}
              onChange={(e) => setEpisode(e.target.value)}
            >
              {Array.from({ length: maxEpisodes }, (_, i) => i + 1).map((num) => (
                <option key={num} value={String(num)}>
                  Episodio {num}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted">de {selectedAnime.episodes || "varios"}</span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Transmisión adaptativa sincronizada en alta definición (1080p).
          </p>
        </div>

        {/* Opciones de Privacidad */}
        <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={inviteOnly}
            onChange={(e) => setInviteOnly(e.target.checked)}
            className="size-4 rounded accent-primary"
          />
          <span>Solo amigos y personas invitadas</span>
        </label>

        <button className="k-btn k-btn-primary w-full py-2.5 font-bold" disabled={busy}>
          {busy ? "Creando sala…" : "Crear y abrir sala"}
        </button>
      </form>

      {/* Listado de Salas Activas */}
      <section aria-labelledby="rooms-h">
        <h2 id="rooms-h" className="font-display text-section mb-4">
          Salas disponibles para unirte
        </h2>
        {rooms.isLoading && <Skeleton className="h-40" />}
        {!rooms.isLoading && (!rooms.data || rooms.data.length === 0) && (
          <EmptyState
            icon={<Users className="size-6" />}
            jp="宴"
            title="No hay salas activas en este momento"
            body="Crea tu propia sala para ver anime con amigos o espera una invitación para unirte."
          />
        )}
        <ul className="grid gap-3.5 sm:grid-cols-2">
          {rooms.data?.map((r) => {
            return (
              <li key={r.id}>
                <Link
                  href={`/watch-parties/${r.id}`}
                  className="k-card flex h-full flex-col justify-between gap-3 p-5 transition-all hover:border-primary hover:shadow-lg"
                >
                  <div>
                    <span className="flex items-center gap-2 mb-1.5">
                      {r.is_playing ? (
                        <Radio className="size-4 animate-pulse text-danger" aria-label="Reproduciendo" />
                      ) : (
                        <Play className="size-4 text-primary" />
                      )}
                      <span className="truncate font-bold text-base">{r.title}</span>
                    </span>
                    <span className="block text-xs text-muted">
                      Episodio {r.episode_id} · Anfitrión:{" "}
                      <strong className="text-fg">{r.host_id === me ? "Tú" : r.host?.display_name || r.host?.username || "Usuario"}</strong>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted pt-2 border-t border-line/60">
                    <span>Iniciada {now ? relativeTime(new Date(r.created_at).getTime(), now) : ""}</span>
                    <span className="k-chip text-[0.68rem] !py-0.5 !px-2 bg-primary/10 text-primary font-semibold">
                      Unirse a la sala →
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
