import { sortChapters, type ReadingAvailability } from "../catalog";
import { DEMO_SERIES, demoByKey, demoChapter } from "../demo/series";
import type { AvailabilityInput, AvailabilityProvider, ChapterCatalogProvider, ChapterContentProvider, Entitlement, ReadingEntitlementProvider } from "./types";

const info = {
  id: "kaze-originals",
  name: "KAZE Originals (demo)",
  kind: "demo" as const,
  rights: "Obra original creada para KAZE como contenido de demostración. No es un manga comercial.",
};

/** Serves the original demonstration series bundled with the app. Fully functional without any external licence. */
export const demoMangaProvider: ChapterCatalogProvider & ChapterContentProvider & ReadingEntitlementProvider & AvailabilityProvider = {
  info,
  hasSeries: (key) => Boolean(demoByKey(key)),
  async listEditions(key) {
    const s = demoByKey(key);
    return s ? [s.edition] : [];
  },
  async listChapters(key, opts) {
    const s = demoByKey(key);
    if (!s) return [];
    const list = s.chapters.filter((c) => !opts?.language || c.language === opts.language);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return sortChapters(list.map(({ pages, ...c }) => c));
  },
  async listVolumes(key) {
    return demoByKey(key)?.volumes ?? [];
  },
  async getPages(chapterId) {
    return demoChapter(chapterId)?.chapter.pages ?? [];
  },
  async canRead(chapterId): Promise<Entitlement> {
    return demoChapter(chapterId) ? { allowed: true, reason: "open-license" } : { allowed: false, reason: "not-licensed", message: "Este capítulo no está disponible en KAZE." };
  },
  availabilityFor({ seriesKey }: AvailabilityInput): ReadingAvailability[] {
    const s = demoByKey(seriesKey);
    if (!s) return [];
    return [{ kind: "embedded", provider: info.id, label: "Leer en KAZE (demo)", url: `/manga/read/${s.slug}/${sortChapters(s.chapters)[0].id}`, language: s.edition.language, official: true, note: info.rights }];
  },
};

export const DEMO_SERIES_KEYS = DEMO_SERIES.map((s) => s.edition.seriesKey);
