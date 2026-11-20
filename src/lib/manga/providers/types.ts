import type { MangaChapter, MangaEdition, MangaVolume, ReadingAsset, ReadingAvailability } from "../catalog";

/**
 * Provider contracts for manga reading. Metadata, chapter catalogs, page assets, entitlements and availability
 * are separate so a licensed source can plug in one capability without pretending to have the others.
 *
 * Rules every provider must follow:
 *  - Serve only content the operator has the right to distribute (original, public-domain or licensed).
 *  - Never scrape, mirror or proxy third-party chapter pages; never bypass paywalls or DRM.
 *  - When content cannot be embedded, return an `external` availability pointing at the official destination.
 */

export type ProviderKind = "demo" | "official-link" | "licensed" | "user-owned";

export type MangaProviderInfo = {
  id: string;
  name: string;
  kind: ProviderKind;
  /** Short human explanation of the rights basis, shown in the UI. */
  rights: string;
};

export interface MangaProvider {
  readonly info: MangaProviderInfo;
  /** Whether this provider knows the given series (AniList id or KAZE slug). */
  hasSeries(seriesKey: string): boolean;
}

export interface ChapterCatalogProvider extends MangaProvider {
  listEditions(seriesKey: string): Promise<MangaEdition[]>;
  listChapters(seriesKey: string, opts?: { language?: string }): Promise<MangaChapter[]>;
  listVolumes(seriesKey: string): Promise<MangaVolume[]>;
}

export interface ChapterContentProvider extends MangaProvider {
  getPages(chapterId: string, opts?: { quality?: "auto" | "high" | "data-saver" }): Promise<ReadingAsset[]>;
}

export type Entitlement = { allowed: true; reason: "open-license" | "licensed" | "owned" } | { allowed: false; reason: "not-licensed" | "sign-in-required" | "region"; message: string };

export interface ReadingEntitlementProvider extends MangaProvider {
  canRead(chapterId: string, viewer: { userId: string | null }): Promise<Entitlement>;
}

export interface AvailabilityProvider {
  readonly info: MangaProviderInfo;
  availabilityFor(input: AvailabilityInput): ReadingAvailability[];
}

export type AvailabilityInput = {
  seriesKey: string;
  externalLinks?: { site: string; url: string; type: string | null; language: string | null; isDisabled: boolean | null }[];
};

/** Series keys: "anilist:<id>" for AniList titles, "kaze:<slug>" for KAZE Originals demo series. */
export const seriesKeyFor = (id: number | string) => (typeof id === "number" ? `anilist:${id}` : `kaze:${id}`);
