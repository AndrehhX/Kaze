/**
 * Anime → manga adaptation mappings.
 * AniList relations say WHICH manga an anime adapts; they never say WHERE the anime stops.
 * Those boundaries live here as reviewed, sourced, versioned records — never computed from episode counts.
 */

export type VerificationStatus = "verified" | "pending" | "approximate" | "unknown";

export type AdaptationRelation =
  | "faithful" // follows the manga closely
  | "reordered" // adapts the same material in a different order
  | "partial" // adapts part of an arc / skips material
  | "anime-original" // diverges or ends with original material
  | "side-story" // adapts a spin-off, prequel volume or side story
  | "compilation"; // recap film / compilation

export type SourceReference = {
  title: string;
  url: string;
  publisher: string;
  /** ISO date the source was consulted. */
  accessedAt: string;
};

export type AdaptationMapping = {
  /** Stable id, e.g. "jjk-s1". */
  id: string;
  /** Groups the seasons/films of one franchise for the timeline. */
  franchise: string;
  /** Position inside the franchise timeline. */
  order: number;
  animeId: number;
  /** Short identifier of the season, part, cour, film or OVA ("s1", "s2-p2", "movie-1"). */
  animeSeason: string;
  animeLabel: string;
  animeFormat: "TV" | "MOVIE" | "OVA" | "ONA" | "SPECIAL";
  /** Episodes covered by this record (inclusive), when the record is per-season. */
  episodeRange: { from: number; to: number } | null;
  mangaId: number;
  /** Printed chapter numbers as strings, so "10.5" or "Extra" survive. */
  mangaChapterStart: string | null;
  mangaChapterEnd: string | null;
  /** Volume that contains the recommended starting chapter, only when a source states it. */
  mangaVolume: string | null;
  /** First chapter NOT adapted by this entry. */
  continuationChapter: string | null;
  /** Where we suggest starting (may be earlier than continuationChapter when the finale only partly adapts a chapter). */
  recommendedStartChapter: string | null;
  /** Other reasonable starting points, each with the reason. */
  alternativeStarts: { chapter: string; reason: string }[];
  relation: AdaptationRelation;
  /** Spoiler-safe notes: never name later events, characters' fates or twists. */
  adaptationNotes: string;
  skippedMaterialWarning: string | null;
  sourceReferences: SourceReference[];
  verificationStatus: VerificationStatus;
  /** Required for "approximate": why the figure is an estimate and what it rests on. */
  basis: string | null;
  verifiedAt: string | null;
  updatedAt: string;
  revision: number;
};

export type MappingSubmission = {
  animeId: number;
  animeSeason: string;
  mangaId: number;
  mangaChapterEnd: string | null;
  continuationChapter: string;
  notes: string;
  sourceUrls: string[];
};

export type ContinuityLookup =
  | {
      status: "found";
      franchise: string;
      timeline: AdaptationMapping[];
      /** Records for the requested anime (several when one AniList entry has multiple parts). */
      current: AdaptationMapping[];
      issues: MappingIssue[];
    }
  | { status: "none"; animeId: number };

export type MappingIssue = { kind: "overlap" | "gap" | "duplicate" | "order"; ids: string[]; message: string };

export const VERIFICATION_META: Record<VerificationStatus, { label: string; tone: "ok" | "warn" | "info" | "muted"; description: string }> = {
  verified: { label: "Verificado", tone: "ok", description: "Coinciden al menos dos fuentes independientes; revisado por el equipo de KAZE." },
  approximate: { label: "Aproximado", tone: "warn", description: "Hay una base documentada, pero las fuentes difieren o la adaptación es parcial. Se indica el motivo." },
  pending: { label: "Pendiente de revisión", tone: "info", description: "Enviado por la comunidad; aún no ha sido revisado. Úsalo con cautela." },
  unknown: { label: "Sin verificar", tone: "muted", description: "Todavía no hay un capítulo de continuación verificado." },
};
