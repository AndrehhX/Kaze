import { creditsOf, mangaTitle, originLabel, type MangaCard } from "@/lib/anilist/manga-types";
import { mangaHref, snapshotFromManga, type MangaLibraryEntry } from "@/lib/manga/types";
import { demoSnapshot, type DemoSeries } from "@/lib/manga/demo/series";
import { sortChapters } from "@/lib/manga/catalog";
import type { VaultItem } from "./vault";

export function vaultItemFromCard(m: MangaCard, key = String(m.id)): VaultItem {
  return {
    key,
    id: m.id,
    title: mangaTitle(m),
    titleNative: m.title.native,
    author: creditsOf(m).author,
    cover: m.coverImage.extraLarge || m.coverImage.large,
    coverSmall: m.coverImage.large || m.coverImage.extraLarge,
    color: m.coverImage.color,
    href: mangaHref(m.id),
    readHref: null,
    genres: m.genres,
    score: m.averageScore,
    meta: [originLabel(m.countryOfOrigin, m.format), m.startDate?.year, m.volumes ? `${m.volumes} vol.` : m.chapters ? `${m.chapters} cap.` : null].filter(Boolean).join(" · "),
    volumes: m.volumes,
    ref: { id: m.id, snapshot: snapshotFromManga(m) },
  };
}

export function vaultItemFromEntry(e: MangaLibraryEntry): VaultItem {
  const s = e.media;
  return {
    key: String(e.mangaId),
    id: e.mangaId,
    title: s.title,
    titleNative: s.titleNative,
    author: s.author,
    cover: s.cover,
    coverSmall: s.cover,
    color: s.color,
    href: mangaHref(e.mangaId, s.slug),
    readHref: s.slug && e.lastChapterId ? `/manga/read/${s.slug}/${e.lastChapterId}` : null,
    genres: s.genres,
    score: s.averageScore,
    meta: [originLabel(s.country, s.format), e.progress ? `cap. ${e.progress}${s.chapters ? `/${s.chapters}` : ""}` : null].filter(Boolean).join(" · "),
    volumes: s.volumes,
    ref: { id: e.mangaId, snapshot: s },
  };
}

export function vaultItemFromDemo(d: DemoSeries): VaultItem {
  return {
    key: d.slug,
    id: d.id,
    title: d.title,
    titleNative: d.titleNative,
    author: d.author,
    cover: d.cover,
    coverSmall: d.cover,
    color: d.color,
    href: `/manga/${d.slug}`,
    readHref: `/manga/read/${d.slug}/${sortChapters(d.chapters)[0].id}`,
    genres: d.genres,
    score: null,
    meta: `Demo original · ${d.chapters.length} cap.`,
    volumes: Math.max(1, d.volumes.length),
    ref: { id: d.id, snapshot: demoSnapshot(d) },
  };
}
