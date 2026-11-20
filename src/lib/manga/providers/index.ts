import type { ReadingAvailability } from "../catalog";
import { demoMangaProvider } from "./demo";
import { officialLinksProvider } from "./official-links";
import { mangaDexProvider } from "./mangadex";
import type { AvailabilityInput, ChapterCatalogProvider, ChapterContentProvider } from "./types";

/**
 * Provider registry. Connects KAZE Originals demo series and MangaDex multi-language catalog.
 */
export const CATALOG_PROVIDERS: ChapterCatalogProvider[] = [demoMangaProvider, mangaDexProvider];
export const CONTENT_PROVIDERS: ChapterContentProvider[] = [demoMangaProvider, mangaDexProvider];

export function catalogFor(seriesKey: string) {
  return CATALOG_PROVIDERS.find((p) => p.hasSeries(seriesKey)) ?? null;
}

export function contentFor(seriesKey: string) {
  return CONTENT_PROVIDERS.find((p) => p.hasSeries(seriesKey)) ?? mangaDexProvider;
}

/** Embedded (readable in KAZE) options first, then official external destinations. */
export function availabilityFor(input: AvailabilityInput): ReadingAvailability[] {
  return [...demoMangaProvider.availabilityFor(input), ...officialLinksProvider.availabilityFor(input)];
}

export { demoMangaProvider, officialLinksProvider, mangaDexProvider };
export * from "./types";
