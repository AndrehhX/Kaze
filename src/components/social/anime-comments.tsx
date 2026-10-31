"use client";

import { useState, useEffect, useRef, ReactNode } from "react";
import Link from "next/link";
import {
  Heart,
  MessageSquare,
  Send,
  Trash2,
  AlertTriangle,
  ExternalLink,
  Sparkles,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/stores/auth";
import { useGuestProfile } from "@/lib/profile/guest";
import { Avatar } from "@/components/shell/user-menu";
import { cn, relativeTime } from "@/lib/utils";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export interface CommentUserStats {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  banner_url?: string | null;
  bio?: string | null;
  likesReceived: number;
  globalComments: number;
}

export interface AnimeCommentItem {
  id: string;
  anime_id: string;
  episode_id?: string | null;
  user_id: string;
  author: CommentUserStats;
  body: string;
  has_spoilers: boolean;
  like_count: number;
  created_at: string;
}

/**
 * Tarjeta flotante (Hover Card) que se despliega al pasar el cursor sobre el perfil del comentarista.
 * Muestra avatar, banner en miniatura, likes recibidos y comentarios globales.
 */
export function ProfileHoverCard({
  user,
  children,
}: {
  user: CommentUserStats;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setOpen(true);
    }, 140);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setOpen(false);
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      {open && (
        <div
          role="tooltip"
          className="absolute left-0 bottom-full z-50 mb-2 w-72 origin-bottom-left rounded-2xl border border-line bg-surface/95 p-0 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Banner en pequeñito */}
          <div className="relative h-16 w-full overflow-hidden rounded-t-2xl bg-gradient-to-r from-primary/30 via-accent/30 to-purple-600/30 border-b border-line/40">
            {user.banner_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.banner_url}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_30%,var(--k-primary),transparent_60%),radial-gradient(ellipse_at_80%_70%,var(--k-accent),transparent_50%)] opacity-70" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          </div>

          {/* Avatar superpuesto + Header */}
          <div className="relative px-3.5 pb-3.5 pt-0">
            <div className="-mt-6 flex items-end justify-between">
              <div className="relative rounded-full ring-3 ring-surface bg-surface shadow-md">
                <Avatar
                  src={user.avatar_url ?? undefined}
                  name={user.display_name || user.username}
                  size={46}
                />
              </div>
              <Link
                href={`/profile/${encodeURIComponent(user.username)}`}
                className="k-btn k-btn-ghost k-btn-xs flex items-center gap-1 text-[0.6875rem] font-semibold text-primary hover:text-primary-ink"
              >
                Ver perfil <ExternalLink className="size-3" />
              </Link>
            </div>

            <div className="mt-2">
              <h4 className="truncate text-sm font-bold text-fg">
                {user.display_name || user.username}
              </h4>
              <p className="text-[0.6875rem] font-medium text-muted">
                @{user.username}
              </p>
            </div>

            {user.bio && (
              <p className="mt-1.5 line-clamp-2 text-xs text-muted/90">
                {user.bio}
              </p>
            )}

            {/* Estadísticas de Likes recibidos y Comentarios globales */}
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-elevated/80 p-2 border border-line/50">
              <div className="flex items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-pink-500/15 text-pink-500">
                  <Heart className="size-3.5 fill-pink-500/30 text-pink-500" />
                </span>
                <div className="min-w-0">
                  <span className="block text-xs font-bold text-fg">
                    {user.likesReceived ?? 0}
                  </span>
                  <span className="block truncate text-[0.625rem] text-muted uppercase tracking-wider font-semibold">
                    Likes recibidos
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <MessageSquare className="size-3.5 fill-primary/30 text-primary" />
                </span>
                <div className="min-w-0">
                  <span className="block text-xs font-bold text-fg">
                    {user.globalComments ?? 0}
                  </span>
                  <span className="block truncate text-[0.625rem] text-muted uppercase tracking-wider font-semibold">
                    Comentarios
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Gestor de almacenamiento local y estadísticas para comentarios de anime (por capítulo)
 */
function getStorageKey(animeId: string, episodeId?: string): string {
  if (episodeId) {
    return `kaze:anime_comments_${animeId}_ep_${episodeId}`;
  }
  return `kaze:anime_comments_${animeId}_general`;
}

const STATS_KEY = "kaze:user_comment_stats";

function getUserStatsMap(): Record<string, { likesReceived: number; globalComments: number }> {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function updateUserStats(
  username: string,
  updater: (prev: { likesReceived: number; globalComments: number }) => { likesReceived: number; globalComments: number }
) {
  try {
    const map = getUserStatsMap();
    const current = map[username] || { likesReceived: 0, globalComments: 0 };
    map[username] = updater(current);
    localStorage.setItem(STATS_KEY, JSON.stringify(map));
  } catch {}
}

export function AnimeComments({
  seriesId,
  episodeId,
  animeTitle,
}: {
  seriesId: string;
  episodeId?: string;
  animeTitle?: string;
}) {
  const authUser = useAuth((s) => s.user);
  const authProfile = useAuth((s) => s.profile);
  const [guestProfile] = useGuestProfile();

  const [comments, setComments] = useState<AnimeCommentItem[]>([]);
  const [bodyText, setBodyText] = useState("");
  const [hasSpoilers, setHasSpoilers] = useState(false);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<string, boolean>>({});
  const [likedComments, setLikedComments] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Perfil del usuario activo para comentar
  const activeUser = authProfile
    ? {
        id: authUser?.id || "auth-user",
        username: authProfile.username,
        display_name: authProfile.display_name || authProfile.username,
        avatar_url: authProfile.avatar_url,
        banner_url: authProfile.banner_url,
        bio: authProfile.bio,
      }
    : {
        id: "guest-user",
        username: guestProfile.username || "invitado",
        display_name: guestProfile.display_name || "Invitado",
        avatar_url: guestProfile.avatar_url,
        banner_url: guestProfile.banner_url,
        bio: guestProfile.bio,
      };

  // Cargar comentarios estrictamente por episodio sin mockups
  useEffect(() => {
    const loadComments = () => {
      try {
        const key = getStorageKey(seriesId, episodeId);
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          // Filtrar cualquier comentario mock up o de seed antiguo
          const realComments = Array.isArray(parsed)
            ? parsed.filter(
                (c: AnimeCommentItem) =>
                  c.id !== "seed-1" &&
                  c.id !== "seed-2" &&
                  c.author?.username !== "AkiraOtaku" &&
                  c.author?.username !== "MakotoShiro"
              )
            : [];

          const statsMap = getUserStatsMap();
          // Sincronizar estadísticas dinámicas de los autores
          const withLiveStats = realComments.map((c: AnimeCommentItem) => {
            const authorStats = statsMap[c.author.username];
            if (authorStats) {
              return {
                ...c,
                author: {
                  ...c.author,
                  likesReceived: authorStats.likesReceived,
                  globalComments: authorStats.globalComments,
                },
              };
            }
            return c;
          });
          setComments(withLiveStats);

          // Si había semillas antiguas guardadas en esta clave, limpiarlas
          if (realComments.length !== parsed.length) {
            localStorage.setItem(key, JSON.stringify(realComments));
          }
        } else {
          // Sección limpia de inicio: cero mock ups
          setComments([]);
        }

        // Limpiar mockups de la clave general legacy si existía
        const legacyKey = `kaze:anime_comments_${seriesId}`;
        const legacyRaw = localStorage.getItem(legacyKey);
        if (legacyRaw) {
          try {
            const legacyParsed = JSON.parse(legacyRaw);
            const onlySeeds = Array.isArray(legacyParsed) && legacyParsed.every(
              (c: any) =>
                c.id === "seed-1" ||
                c.id === "seed-2" ||
                c.author?.username === "AkiraOtaku" ||
                c.author?.username === "MakotoShiro"
            );
            if (onlySeeds) {
              localStorage.removeItem(legacyKey);
            }
          } catch {}
        }
      } catch {
        setComments([]);
      }
    };

    // Cargar likes locales del usuario
    try {
      const rawLikes = localStorage.getItem("kaze:my_comment_likes");
      if (rawLikes) setLikedComments(JSON.parse(rawLikes));
    } catch {}

    loadComments();
  }, [seriesId, episodeId]);

  // Guardar likes locales
  const saveLikedComments = (nextLikes: Record<string, boolean>) => {
    setLikedComments(nextLikes);
    try {
      localStorage.setItem("kaze:my_comment_likes", JSON.stringify(nextLikes));
    } catch {}
  };

  // Publicar comentario
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = bodyText.trim();
    if (!cleanText) return;

    setIsSubmitting(true);

    const statsMap = getUserStatsMap();
    const myCurrentStats = statsMap[activeUser.username] || { likesReceived: 0, globalComments: 0 };
    const nextGlobalComments = myCurrentStats.globalComments + 1;

    // Actualizar estadísticas globales del usuario
    updateUserStats(activeUser.username, (prev) => ({
      ...prev,
      globalComments: nextGlobalComments,
    }));

    const newComment: AnimeCommentItem = {
      id: "c-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      anime_id: seriesId,
      episode_id: episodeId || null,
      user_id: activeUser.id,
      author: {
        id: activeUser.id,
        username: activeUser.username,
        display_name: activeUser.display_name,
        avatar_url: activeUser.avatar_url,
        banner_url: activeUser.banner_url,
        bio: activeUser.bio,
        likesReceived: myCurrentStats.likesReceived,
        globalComments: nextGlobalComments,
      },
      body: cleanText,
      has_spoilers: hasSpoilers,
      like_count: 0,
      created_at: new Date().toISOString(),
    };

    const nextList = [newComment, ...comments];
    setComments(nextList);
    try {
      localStorage.setItem(getStorageKey(seriesId, episodeId), JSON.stringify(nextList));
    } catch {}

    // Intento de guardado en Supabase si está disponible
    try {
      const sb = getSupabaseBrowser();
      if (sb && authUser) {
        sb.from("comments")
          .insert({
            user_id: authUser.id,
            target_type: "discussion",
            target_id: `${seriesId}:${episodeId || "1"}`,
            body: cleanText,
            has_spoilers: hasSpoilers,
          })
          .then(() => {}, () => {});
      }
    } catch {}

    setBodyText("");
    setHasSpoilers(false);
    setIsSubmitting(false);
    toast.success("Comentario publicado");
  };

  // Alternar Like en un comentario
  const handleToggleLike = (commentId: string) => {
    const isLiked = Boolean(likedComments[commentId]);
    const nextLikedState = !isLiked;
    const nextLikes = { ...likedComments, [commentId]: nextLikedState };
    saveLikedComments(nextLikes);

    const updated = comments.map((c) => {
      if (c.id === commentId) {
        const delta = nextLikedState ? 1 : -1;
        const newCount = Math.max(0, c.like_count + delta);

        // Actualizar los likes totales recibidos por el autor
        updateUserStats(c.author.username, (prev) => ({
          ...prev,
          likesReceived: Math.max(0, prev.likesReceived + delta),
        }));

        return {
          ...c,
          like_count: newCount,
          author: {
            ...c.author,
            likesReceived: Math.max(0, c.author.likesReceived + delta),
          },
        };
      }
      return c;
    });

    setComments(updated);
    try {
      localStorage.setItem(getStorageKey(seriesId, episodeId), JSON.stringify(updated));
    } catch {}
  };

  // Eliminar comentario
  const handleDeleteComment = (commentId: string) => {
    const target = comments.find((c) => c.id === commentId);
    if (!target) return;

    if (target.user_id !== activeUser.id && target.author.username !== activeUser.username) {
      toast.error("Solo puedes eliminar tus propios comentarios");
      return;
    }

    const nextList = comments.filter((c) => c.id !== commentId);
    setComments(nextList);
    try {
      localStorage.setItem(getStorageKey(seriesId, episodeId), JSON.stringify(nextList));
    } catch {}

    // Descontar comentario global
    updateUserStats(activeUser.username, (prev) => ({
      ...prev,
      globalComments: Math.max(0, prev.globalComments - 1),
    }));

    toast.success("Comentario eliminado");
  };

  return (
    <section className="mt-8 rounded-3xl border border-line bg-surface/75 p-4 sm:p-6 backdrop-blur-md shadow-sm">
      {/* Cabecera de la sección de comentarios */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line/60 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <MessageSquare className="size-4" />
          </span>
          <div>
            <h3 className="text-base font-bold text-fg">
              {episodeId ? `Comentarios del Episodio ${episodeId}` : "Comentarios de la Comunidad"}
            </h3>
            <p className="text-xs text-muted">
              {animeTitle ? `${animeTitle} · ` : ""}
              {comments.length} {comments.length === 1 ? "opinión" : "opiniones"}
            </p>
          </div>
        </div>

        {episodeId && (
          <div className="inline-flex items-center gap-1.5 rounded-xl bg-elevated/80 px-3 py-1.5 border border-line text-xs font-semibold text-muted">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            <span>Capítulo {episodeId}</span>
          </div>
        )}
      </div>

      {/* Formulario para publicar comentario */}
      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        <div className="flex gap-3">
          <div className="shrink-0 pt-1">
            <ProfileHoverCard
              user={{
                id: activeUser.id,
                username: activeUser.username,
                display_name: activeUser.display_name,
                avatar_url: activeUser.avatar_url,
                banner_url: activeUser.banner_url,
                bio: activeUser.bio,
                likesReceived: getUserStatsMap()[activeUser.username]?.likesReceived ?? 0,
                globalComments: getUserStatsMap()[activeUser.username]?.globalComments ?? 0,
              }}
            >
              <div className="cursor-pointer transition-transform hover:scale-105">
                <Avatar
                  src={activeUser.avatar_url ?? undefined}
                  name={activeUser.display_name}
                  size={36}
                />
              </div>
            </ProfileHoverCard>
          </div>

          <div className="flex-1 space-y-2">
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder={
                episodeId
                  ? `¿Qué te pareció el episodio ${episodeId}? Escribe tu comentario...`
                  : "¿Qué te pareció este anime? Escribe tu comentario..."
              }
              rows={3}
              maxLength={2000}
              className="k-input w-full resize-none text-sm rounded-2xl bg-elevated/70 border-line/80 focus:border-primary p-3"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-muted hover:text-fg transition-colors select-none">
                <input
                  type="checkbox"
                  checked={hasSpoilers}
                  onChange={(e) => setHasSpoilers(e.target.checked)}
                  className="rounded border-line bg-elevated text-primary focus:ring-primary size-3.5"
                />
                <span className="flex items-center gap-1">
                  <AlertTriangle className="size-3 text-amber-500" />
                  Contiene spoilers
                </span>
              </label>

              <button
                type="submit"
                disabled={!bodyText.trim() || isSubmitting}
                className="k-btn k-btn-primary k-btn-sm flex items-center gap-1.5 px-4 rounded-xl shadow-sm disabled:opacity-50"
              >
                <Send className="size-3.5" />
                <span>Comentar</span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Lista de comentarios */}
      <div className="mt-6 space-y-4">
        {comments.length === 0 ? (
          <div className="py-8 text-center text-muted">
            <MessageSquare className="size-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">Aún no hay comentarios en este episodio.</p>
            <p className="text-xs text-muted/80">¡Sé el primero en compartir tu opinión!</p>
          </div>
        ) : (
          comments.map((c) => {
            const isLiked = Boolean(likedComments[c.id]);
            const isMyComment =
              c.user_id === activeUser.id || c.author.username === activeUser.username;
            const isSpoilerHidden = c.has_spoilers && !revealedSpoilers[c.id];

            return (
              <div
                key={c.id}
                className="group relative flex gap-3.5 rounded-2xl border border-line/50 bg-elevated/40 p-3.5 transition-all hover:bg-elevated/70 hover:border-line"
              >
                {/* Avatar con HoverCard */}
                <div className="shrink-0 pt-0.5">
                  <ProfileHoverCard user={c.author}>
                    <div className="cursor-pointer transition-transform hover:scale-105">
                      <Avatar
                        src={c.author.avatar_url ?? undefined}
                        name={c.author.display_name || c.author.username}
                        size={36}
                      />
                    </div>
                  </ProfileHoverCard>
                </div>

                <div className="min-w-0 flex-1">
                  {/* Autor y fecha */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ProfileHoverCard user={c.author}>
                        <Link
                          href={`/profile/${encodeURIComponent(c.author.username)}`}
                          className="text-xs font-bold text-fg hover:text-primary transition-colors cursor-pointer"
                        >
                          {c.author.display_name || c.author.username}
                        </Link>
                      </ProfileHoverCard>
                      <span className="text-[0.6875rem] text-muted">
                        @{c.author.username}
                      </span>
                      <span className="text-[0.625rem] text-muted/60">•</span>
                      <span className="text-[0.6875rem] text-muted">
                        {relativeTime(new Date(c.created_at).getTime(), Date.now())}
                      </span>
                      {c.episode_id && (
                        <span className="rounded bg-line/80 px-1.5 py-0.2 text-[0.625rem] font-mono text-muted uppercase">
                          Ep. {c.episode_id}
                        </span>
                      )}
                    </div>

                    {isMyComment && (
                      <button
                        type="button"
                        onClick={() => handleDeleteComment(c.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-all"
                        title="Eliminar mi comentario"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Cuerpo del comentario (con soporte para Spoilers) */}
                  <div className="mt-1.5">
                    {c.has_spoilers && (
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[0.625rem] font-bold text-amber-500 border border-amber-500/30">
                          <AlertTriangle className="size-2.5" /> SPOILER
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setRevealedSpoilers((prev) => ({
                              ...prev,
                              [c.id]: !prev[c.id],
                            }))
                          }
                          className="flex items-center gap-1 text-[0.6875rem] text-primary hover:underline font-semibold"
                        >
                          {isSpoilerHidden ? (
                            <>
                              <Eye className="size-3" /> Ver spoiler
                            </>
                          ) : (
                            <>
                              <EyeOff className="size-3" /> Ocultar
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    <p
                      className={cn(
                        "whitespace-pre-line break-words text-sm leading-relaxed transition-all",
                        isSpoilerHidden &&
                          "select-none blur-sm filter bg-black/10 rounded px-1 cursor-pointer"
                      )}
                      onClick={() => {
                        if (isSpoilerHidden) {
                          setRevealedSpoilers((prev) => ({ ...prev, [c.id]: true }));
                        }
                      }}
                    >
                      {c.body}
                    </p>
                  </div>

                  {/* Acciones del comentario: Like */}
                  <div className="mt-2.5 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleToggleLike(c.id)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all border",
                        isLiked
                          ? "border-pink-500/40 bg-pink-500/15 text-pink-500 shadow-sm"
                          : "border-line bg-surface/50 text-muted hover:text-fg hover:border-line/80"
                      )}
                    >
                      <Heart
                        className={cn(
                          "size-3.5 transition-transform active:scale-125",
                          isLiked && "fill-pink-500 text-pink-500"
                        )}
                      />
                      <span>{c.like_count}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
