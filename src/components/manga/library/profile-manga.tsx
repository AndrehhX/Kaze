"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { mangaRowToEntry } from "@/lib/data/manga-remote";
import { useMangaLibrary } from "@/stores/manga";
import { mangaHref, type MangaLibraryEntry } from "@/lib/manga/types";
import { SafeImage } from "@/components/ui/primitives";

/**
 * Manga on profiles. Your own profile reads device/account data; other profiles are read through Supabase,
 * where RLS applies the owner's "lists" privacy facet — nothing private is fetched or shown.
 */
export function ProfileMangaShelf({ userId, isMe }: { userId: string | null; isMe: boolean }) {
  const mine = useMangaLibrary((s) => s.entries);
  const remote = useQuery({
    queryKey: ["profile-manga", userId],
    enabled: Boolean(userId && !isMe && getSupabaseBrowser()),
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser()!.from("manga_library_entries").select("*").eq("user_id", userId!).order("updated_at", { ascending: false }).limit(60);
      if (error) return [];
      return (data ?? []).map((r) => mangaRowToEntry(r as Parameters<typeof mangaRowToEntry>[0]));
    },
  });
  const entries: MangaLibraryEntry[] = useMemo(() => (isMe ? Object.values(mine).filter((e) => e.mangaId > 0 || isMe) : (remote.data ?? [])), [isMe, mine, remote.data]);
  const reading = entries.filter((e) => e.status === "CURRENT" || e.status === "REPEATING").slice(0, 6);
  const favorites = entries.filter((e) => e.favorite).slice(0, 12);
  if (!reading.length && !favorites.length) return null;
  return (
    <>
      {reading.length > 0 && (
        <section aria-labelledby="manga-reading-h">
          <h2 id="manga-reading-h" className="font-display text-section mb-4">
            Leyendo manga
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {reading.map((e) => (
              <li key={e.mangaId}>
                <Link href={mangaHref(e.mangaId, e.media.slug)} className="k-card flex items-center gap-3 p-2.5 transition-colors hover:border-primary">
                  <div className="k-poster relative aspect-[2/3] w-12 shrink-0">
                    <SafeImage src={e.media.cover ?? ""} alt="" fill sizes="48px" className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{e.media.title}</p>
                    <p className="text-xs text-muted">
                      Capítulo {e.progress}
                      {e.media.chapters ? `/${e.media.chapters}` : ""}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {favorites.length > 0 && (
        <section aria-labelledby="manga-fav-h">
          <h2 id="manga-fav-h" className="font-display text-section mb-4">
            Manga favoritos ({favorites.length})
          </h2>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {favorites.map((e) => (
              <li key={e.mangaId}>
                <Link href={mangaHref(e.mangaId, e.media.slug)} className="km-book block" title={e.media.title}>
                  <div className="k-poster relative aspect-[2/3]">
                    <SafeImage src={e.media.cover ?? ""} alt={e.media.title} fill sizes="140px" className="object-cover" />
                  </div>
                </Link>
                <p className="mt-1 truncate text-center text-xs font-medium">{e.media.title}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
