import { z } from "zod";
import { parseChapterNumber } from "../catalog";
import { ADAPTATION_DATASET } from "./dataset";
import type { AdaptationMapping, ContinuityLookup, MappingIssue, MappingSubmission, VerificationStatus } from "./types";

const chapterNo = z.string().regex(/^\d+(\.\d+)?$/, "Número de capítulo inválido");
const url = z.string().url().refine((u) => u.startsWith("https://"), "Las fuentes deben usar https");

const mappingSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    franchise: z.string().regex(/^[a-z0-9-]+$/),
    order: z.number().int().min(0),
    animeId: z.number().int().positive(),
    animeSeason: z.string().min(1).max(40),
    animeLabel: z.string().min(1).max(80),
    animeFormat: z.enum(["TV", "MOVIE", "OVA", "ONA", "SPECIAL"]),
    episodeRange: z.object({ from: z.number().int().min(0), to: z.number().int().min(0) }).nullable(),
    mangaId: z.number().int().positive(),
    mangaChapterStart: chapterNo.nullable(),
    mangaChapterEnd: chapterNo.nullable(),
    mangaVolume: z.string().max(12).nullable(),
    continuationChapter: chapterNo.nullable(),
    recommendedStartChapter: chapterNo.nullable(),
    alternativeStarts: z.array(z.object({ chapter: chapterNo, reason: z.string().min(4).max(300) })),
    relation: z.enum(["faithful", "reordered", "partial", "anime-original", "side-story", "compilation"]),
    adaptationNotes: z.string().max(600),
    skippedMaterialWarning: z.string().max(300).nullable(),
    sourceReferences: z.array(z.object({ title: z.string().min(2), url, publisher: z.string().min(2), accessedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })),
    verificationStatus: z.enum(["verified", "pending", "approximate", "unknown"]),
    basis: z.string().max(400).nullable(),
    verifiedAt: z.string().nullable(),
    updatedAt: z.string(),
    revision: z.number().int().min(1),
  })
  .superRefine((m, ctx) => {
    const start = parseChapterNumber(m.mangaChapterStart);
    const end = parseChapterNumber(m.mangaChapterEnd);
    const cont = parseChapterNumber(m.continuationChapter);
    if (m.episodeRange && m.episodeRange.to < m.episodeRange.from) ctx.addIssue({ code: "custom", message: "El rango de episodios está invertido", path: ["episodeRange"] });
    if (start != null && end != null && end < start) ctx.addIssue({ code: "custom", message: "El capítulo final es anterior al inicial", path: ["mangaChapterEnd"] });
    if (end != null && cont != null && cont <= end) ctx.addIssue({ code: "custom", message: "La continuación debe ser posterior al último capítulo adaptado", path: ["continuationChapter"] });
    if (m.verificationStatus === "verified") {
      if (m.sourceReferences.length < 2) ctx.addIssue({ code: "custom", message: "Un registro verificado necesita al menos dos fuentes", path: ["sourceReferences"] });
      if (!m.verifiedAt) ctx.addIssue({ code: "custom", message: "Falta la fecha de verificación", path: ["verifiedAt"] });
      if (!m.continuationChapter) ctx.addIssue({ code: "custom", message: "Un registro verificado necesita capítulo de continuación", path: ["continuationChapter"] });
    }
    if (m.verificationStatus === "approximate" && !m.basis) ctx.addIssue({ code: "custom", message: "Un registro aproximado debe documentar su base", path: ["basis"] });
    if (m.verificationStatus === "approximate" && m.sourceReferences.length < 1) ctx.addIssue({ code: "custom", message: "Un registro aproximado necesita al menos una fuente", path: ["sourceReferences"] });
    if (m.verificationStatus === "unknown" && (m.continuationChapter || m.recommendedStartChapter)) ctx.addIssue({ code: "custom", message: "Un registro desconocido no puede afirmar un capítulo de continuación", path: ["continuationChapter"] });
  });

export function validateMapping(input: unknown): { ok: true; mapping: AdaptationMapping } | { ok: false; errors: string[] } {
  const r = mappingSchema.safeParse(input);
  if (r.success) return { ok: true, mapping: r.data as AdaptationMapping };
  return { ok: false, errors: r.error.issues.map((i) => `${i.path.join(".") || "registro"}: ${i.message}`) };
}

/** Detects overlaps, unexplained gaps, duplicate seasons and ordering problems inside one franchise. */
export function detectIssues(records: AdaptationMapping[]): MappingIssue[] {
  const issues: MappingIssue[] = [];
  const bySeason = new Map<string, AdaptationMapping[]>();
  for (const r of records) {
    const k = `${r.animeId}|${r.animeSeason}`;
    bySeason.set(k, [...(bySeason.get(k) ?? []), r]);
  }
  for (const list of bySeason.values()) {
    if (list.length > 1) {
      const continuations = new Set(list.map((l) => l.continuationChapter));
      issues.push({ kind: "duplicate", ids: list.map((l) => l.id), message: continuations.size > 1 ? "Hay registros en conflicto para la misma temporada" : "Registros duplicados para la misma temporada" });
    }
  }
  const byManga = new Map<number, AdaptationMapping[]>();
  for (const r of records) byManga.set(r.mangaId, [...(byManga.get(r.mangaId) ?? []), r]);
  for (const list of byManga.values()) {
    const sorted = [...list].sort((a, b) => a.order - b.order);
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1];
      const b = sorted[i];
      if (a.order === b.order) issues.push({ kind: "order", ids: [a.id, b.id], message: "Dos registros comparten la misma posición en la cronología" });
      const aEnd = parseChapterNumber(a.mangaChapterEnd);
      const bStart = parseChapterNumber(b.mangaChapterStart);
      if (aEnd == null || bStart == null) continue;
      if (bStart <= aEnd) issues.push({ kind: "overlap", ids: [a.id, b.id], message: `${b.animeLabel} empieza (cap. ${b.mangaChapterStart}) antes de que termine ${a.animeLabel} (cap. ${a.mangaChapterEnd})` });
      else if (bStart > aEnd + 1 && b.relation !== "anime-original" && b.relation !== "side-story") issues.push({ kind: "gap", ids: [a.id, b.id], message: `Capítulos ${aEnd + 1}–${bStart - 1} no aparecen en ninguna adaptación registrada` });
    }
  }
  return issues;
}

/** Records that pass validation. Invalid records are dropped (and reported in development), never shown as fact. */
export function loadDataset(records: unknown[] = ADAPTATION_DATASET): AdaptationMapping[] {
  const out: AdaptationMapping[] = [];
  for (const r of records) {
    const v = validateMapping(r);
    if (v.ok) out.push(v.mapping);
    else if (process.env.NODE_ENV !== "production") console.warn("[kaze] invalid adaptation mapping", (r as { id?: string }).id, v.errors);
  }
  return out;
}

export function lookupContinuity(animeId: number, records: AdaptationMapping[] = loadDataset()): ContinuityLookup {
  const current = records.filter((r) => r.animeId === animeId).sort((a, b) => a.order - b.order);
  if (!current.length) return { status: "none", animeId };
  const franchise = current[0].franchise;
  const timeline = records.filter((r) => r.franchise === franchise).sort((a, b) => a.order - b.order);
  return { status: "found", franchise, timeline, current, issues: detectIssues(timeline) };
}

export function mappingsForManga(mangaId: number, records: AdaptationMapping[] = loadDataset()) {
  return records.filter((r) => r.mangaId === mangaId).sort((a, b) => a.order - b.order);
}

/** Strongest status first, so the UI never presents a weaker record as the headline. */
const STRENGTH: Record<VerificationStatus, number> = { verified: 3, approximate: 2, pending: 1, unknown: 0 };
export function strongest(records: AdaptationMapping[]): AdaptationMapping | null {
  return [...records].sort((a, b) => STRENGTH[b.verificationStatus] - STRENGTH[a.verificationStatus])[0] ?? null;
}

/**
 * What the reader should actually see. Precision is only claimed for verified/approximate records with a chapter;
 * everything else degrades to an honest "not verified" state.
 */
export function presentRecommendation(m: AdaptationMapping | null) {
  if (!m || m.verificationStatus === "unknown" || !m.recommendedStartChapter) {
    return { kind: "unverified" as const, headline: "Capítulo de continuación aún no verificado.", chapter: null, volume: null, status: m?.verificationStatus ?? "unknown" };
  }
  const prefix = m.verificationStatus === "verified" ? "Empieza en el" : m.verificationStatus === "approximate" ? "Te recomendamos empezar en el" : "Según un envío sin revisar, podrías empezar en el";
  return { kind: "recommendation" as const, headline: `${prefix} capítulo ${m.recommendedStartChapter}`, chapter: m.recommendedStartChapter, volume: m.mangaVolume, status: m.verificationStatus };
}

/** Episode-level questions get an honest answer: mappings are per season/part unless a record says otherwise. */
export function episodeCoverage(m: AdaptationMapping, episode: number | null): "finished-season" | "mid-season" | "unknown" {
  if (!m.episodeRange || episode == null) return "unknown";
  return episode >= m.episodeRange.to ? "finished-season" : "mid-season";
}

const submissionSchema = z.object({
  animeId: z.number().int().positive(),
  animeSeason: z.string().trim().min(1).max(40),
  mangaId: z.number().int().positive(),
  mangaChapterEnd: chapterNo.nullable(),
  continuationChapter: chapterNo,
  notes: z.string().trim().max(600),
  sourceUrls: z.array(url).min(1, "Añade al menos una fuente pública").max(5),
});

export function validateSubmission(input: unknown): { ok: true; submission: MappingSubmission } | { ok: false; errors: string[] } {
  const r = submissionSchema.safeParse(input);
  if (!r.success) return { ok: false, errors: r.error.issues.map((i) => i.message) };
  const end = parseChapterNumber(r.data.mangaChapterEnd);
  const cont = parseChapterNumber(r.data.continuationChapter);
  if (end != null && cont != null && cont <= end) return { ok: false, errors: ["La continuación debe ser posterior al último capítulo adaptado"] };
  return { ok: true, submission: r.data };
}
