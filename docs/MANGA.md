# KAZE MANGA

> The anime ends. The story continues.

KAZE MANGA is the manga section of the KAZE web client. It reuses the existing shell, themes, AniList transport, auth, Supabase/RLS model, social layer and settings. Nothing in the anime experience was replaced.

## Routes

| Route | What it is |
| --- | --- |
| `/manga` | Editorial home: featured "issue cover", sections from AniList, explainable recommendations, friends' reading, KAZE Originals |
| `/manga/discover` | Explorer: search with suggestions + recent searches, filters in the URL, grid/list, infinite scroll |
| `/manga/search` | Alias that redirects to `/manga/discover` keeping every query parameter |
| `/manga/trending`, `/manga/seasonal` | Ranked lists (AniList trending; series that started this year) |
| `/manga/shelf` | **La Bóveda** (3D shelf) for your collection, trending, top rated or KAZE Originals |
| `/manga/random` | Randomizer with filters |
| `/manga/[id]` | Detail (AniList id or a KAZE Originals slug) |
| `/manga/[id]/chapters`, `/manga/[id]/volumes` | Catalog (real catalogs only — see below) |
| `/manga/read/[mangaId]/[chapterId]` | Reader (KAZE Originals). AniList ids show official reading destinations instead |
| `/manga/continue/[animeId]` | Continue the story after an anime |
| `/manga/characters/[id]` | Character page with manga and anime appearances; AniList spoiler text stays behind a reveal |
| `/manga/collections`, `/manga/collections/[id]` | Manga collections (private or public) |
| `/manga/reading-stats` | Reading statistics |
| `/library/manga` | Manga library, switchable with the anime library |

Entry points: "Manga" in the primary navigation, "Continuar en manga" on anime pages, and the new "Del anime al manga" section on every anime detail page.

## Architecture

```
src/lib/anilist/manga-*.ts        AniList queries, types, URL params, server service (same transport/cache as anime)
src/lib/manga/catalog.ts          Series ≠ edition ≠ volume ≠ chapter ≠ release ≠ asset ≠ availability
src/lib/manga/providers/          MangaProvider / ChapterCatalogProvider / ChapterContentProvider / ReadingEntitlementProvider
src/lib/manga/demo/               KAZE Originals (original demo series + generated manifest)
src/lib/manga/reader/engine.ts    Pure reader logic (direction, spreads, navigation, gestures, preload, fit)
src/lib/manga/continuity/         Adaptation mapping types, sourced dataset, validation, conflict detection, lookup
src/lib/manga/{random,recommend,stats,sync}.ts
src/stores/manga.ts               Manga library store (device first, Supabase when available)
src/lib/data/manga-remote.ts      Supabase persistence (RLS)
src/components/manga/             UI (home, vault, reader, continuity, library, detail)
supabase/migrations/20261120000000_kaze_manga.sql
scripts/manga-demo/               Generator for the demo artwork
```

### Persistence
- Device first (`localStorage` key `kaze:manga`). When signed in, the store connects to Supabase, merges by newest `updatedAt`, uploads local-only entries and then mirrors writes. If the manga tables are missing (migration not applied), it stays local and says so in the library header — anime persistence is unaffected.
- Reader preferences live in the existing settings store (`useSettings().reader`) and are saved to `user_settings.reader` (new nullable column). They are written in a separate update so core settings keep syncing on databases without the migration.
- Notes reuse `library_notes` (AniList ids are unique across anime and manga).

### Database (additive migration)
New tables: `manga_library_entries`, `manga_reading_progress`, `manga_bookmarks`, `manga_reading_sessions`, `manga_collections`, `manga_collection_items`, `manga_chapter_catalog`, `manga_content_availability`, `anime_manga_adaptation_mappings`, `adaptation_mapping_sources`, `adaptation_mapping_revisions`, `adaptation_mapping_submissions`. One column added: `user_settings.reader`.

RLS: lists follow the owner's `lists` facet (same as anime); page progress follows `history`; bookmarks and sessions are owner-only; public collections need `is_public` and the `lists` facet; mappings are read by everyone but edited only by moderators (`is_moderator()`); submissions can only be inserted as `pending` and are reviewed through `review_adaptation_submission()`. Every mapping insert/update is snapshotted in `adaptation_mapping_revisions`. Check constraints refuse a `verified` row without a verification date and continuation chapter, an `approximate` row without a documented basis, and an `unknown` row that claims a chapter. Manga library changes feed the existing `activity_events` (demo series excluded).

Apply with `supabase db push` (or run the SQL file). The DB test harness now applies every migration in order.

## Content and rights
- **KAZE Originals** (`viento-de-papel`, `senal-nocturna`) are original works created for this project by `scripts/manga-demo/generate.mjs` (`node scripts/manga-demo/generate.mjs` regenerates them deterministically). Every page has descriptive alt text. They are always labelled as demo content.
- Commercial manga: KAZE never scrapes, mirrors, proxies or embeds third-party chapter pages and never bypasses paywalls/DRM. Reading availability for AniList titles comes only from AniList's `externalLinks` of type `STREAMING` (official publisher platforms) and opens the publisher's site.
- Chapter lists are never generated from AniList's total chapter count. Titles without a real catalog show their AniList totals and official destinations.
- To add a licensed source: implement `ChapterCatalogProvider` + `ChapterContentProvider` (+ `ReadingEntitlementProvider`) and register it in `src/lib/manga/providers/index.ts`.

## Continue the Story
- AniList relations identify *which* manga an anime adapts; the *where* comes from `src/lib/manga/continuity/dataset.ts` (and, later, the Supabase tables).
- Statuses: **Verificado** (≥2 independent sources agree on the first unadapted chapter), **Aproximado** (documented basis, sources disagree or the finale partly adapts a chapter), **Pendiente de revisión** (community submission), **Sin verificar**.
- Dataset at release (cross-checked on 2026-11-19 against the cited public guides): Jujutsu Kaisen S1 (verified) and S2 (approximate); Chainsaw Man S1 and the Reze film (verified); Frieren S1 (verified), S2 (unknown); [Oshi no Ko] S1 and S2 (verified), S3 (unknown); Demon Slayer Hashira Training (approximate); Attack on Titan S1 and S2 (approximate). Everything else shows the honest "not verified yet" state with related manga, "start from chapter 1" and a submission form.
- Mappings are per season/part. When the library says the viewer is mid-season, the UI says the episode-level point is not verified and offers the season's starting chapter.
- **"Verified" here means verified against public sources during implementation. An editor should re-check the dataset periodically.**

## Reader
Modes: paged (single / double page, first page alone like printed volumes, spreads never split), vertical, webtoon. Direction: auto (from the series), right-to-left, left-to-right — keyboard, tap zones, swipes and the page slider all follow it. Fit: whole page, width, height, original. Zoom: double-click, pinch, +/−. Animation: Classic (default), Smooth, Cinematic (perspective turn + blurred atmospheric backdrop; the artwork itself is never altered or cropped), Focus (minimal UI). Reduced-motion disables all transitions. Bars get their own space outside Focus mode, so they never cover a panel.

Progress is saved per page (throttled, flushed on hide/unload), the chapter counts as read when its last page is shown, and `?page=N` deep-links. Reading time is measured only while the tab is visible and the reader was used in the last 60 s.

## Testing
- `npm test` — includes `tests/unit/manga.test.ts` and `tests/db/manga.test.ts` (RLS, constraints, revisions, submissions, activity).
- `npx playwright test tests/e2e/manga.spec.ts tests/e2e/manga-a11y.spec.ts` — 11 flows and WCAG 2.2 AA audits of the manga pages, the Vault and the reader in all four themes. Set `PW_CHANNEL=chrome` to use an installed Chrome instead of Playwright's downloaded browsers.

## Known limitations
- No commercial manga is readable inside KAZE; only official external destinations (by design, until a licensed provider is integrated).
- The adaptation dataset is small (12 records) and needs editorial upkeep; no admin UI yet (moderators can review submissions via SQL/RPC).
- AniList does not expose chapter release dates, so "Fichas actualizadas" sorts by AniList metadata edits and says so; "Populares en publicación" is all-time popularity among ongoing series, not a monthly ranking.
- AniList manga list sync is implemented but was **not tested against a real connected AniList account** in this environment (requires OAuth credentials).
- Supabase sync of manga data was tested against the PGlite harness only, not a live project; the migration must be applied before cloud sync activates.
- Demo pages are SVG, so there is no separate data-saver variant (`srcLow` is supported by the provider contract).
- Friend-specific spoiler gating by reading progress is not implemented; spoiler-marked comments/discussions use the existing reveal mechanism.
