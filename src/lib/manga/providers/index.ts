import type { ReadingAvailability } from "../catalog";
import { demoMangaProvider } from "./demo";
import { officialLinksProvider } from "./official-links";
import type { AvailabilityInput, ChapterCatalogProvider, ChapterContentProvider } from "./types";

/**
 * Provider registry. To add a licensed source, implement ChapterCatalogProvider + ChapterContentProvider
 * (+ ReadingEntitlementProvider) and register it here; no UI changes are needed.
 */
export const CATALOG_PROVIDERS: ChapterCatalogProvider[] = [demoMangaProvider];
export const CONTENT_PROVIDERS: ChapterContentProvider[] = [demoMangaProvider];

export function catalogFor(seriesKey: string) {
  return CATALOG_PROVIDERS.find((p) => p.hasSeries(seriesKey)) ?? null;
}

export function contentFor(seriesKey: string) {
  return CONTENT_PROVIDERS.find((p) => p.hasSeries(seriesKey)) ?? null;
}

/** Embedded (readable in KAZE) options first, then official external destinations. */
export function availabilityFor(input: AvailabilityInput): ReadingAvailability[] {
  return [...demoMangaProvider.availabilityFor(input), ...officialLinksProvider.availabilityFor(input)];
}

export { demoMangaProvider, officialLinksProvider };
export * from "./types";
