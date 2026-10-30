# KAZE — The Anime Universe

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript strict · Tailwind v4 · Motion · hls.js · TanStack Query · Zustand · Zod · Supabase (Postgres, Auth, Realtime, RLS, Storage) · AniList GraphQL.

## Quick start

```bash
npm install
cp .env.example .env.local   # all values optional
npm run dev                  # http://localhost:3000
```

Without any env vars you get: the full AniList catalog (home, discover, moods, roulette, similarity graph, seasonal, detail/episodes), four themes, the HLS demo player, and a library/progress/collections store saved on the device. Accounts and social features show an explicit "not configured" state.

## Enabling accounts & social (Supabase)

1. Create a Supabase project; set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
2. Apply `supabase/migrations/20261029000000_kaze_schema.sql` (SQL editor or `supabase db push`), then `supabase/seed.sql` (reference data only — no fake users or activity).
3. Auth → URL configuration: add `<SITE_URL>/auth/callback` as a redirect URL.
4. Rebuild (public env vars are inlined at build time).

## Enabling AniList OAuth

Register a client at anilist.co/settings/developer with redirect `<SITE_URL>/api/integrations/anilist/callback`, then set `NEXT_PUBLIC_ANILIST_CLIENT_ID`, `ANILIST_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY` (plus Supabase incl. service role). Tokens are AES-256-GCM encrypted in a table with RLS and no policies (service role only) and never reach the browser.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Develop / production build / serve |
| `npm run typecheck` · `npm run lint` | TypeScript · ESLint |
| `npm test` | Vitest unit + component tests (33) |
| `npm run test:e2e` | Playwright (desktop + mobile) |

## Architecture

- `src/lib/anilist` — typed GraphQL client (dedupe, 429 retry), cached service (`"use cache"` + `cacheLife`), URL filter parsing. The home page is one aliased query.
- `src/app/api` — AniList proxy routes with per-IP rate limiting; playback grants; AniList OAuth/sync; account deletion.
- `src/lib/media` — provider abstraction. `demo-catalog.ts` is the only provider: Blender Foundation open films (CC BY) on public HLS test streams. AniList metadata never implies streaming rights; AniList titles show official streaming links instead.
- `src/stores` — Zustand stores (settings, library, progress, local). Guests persist to localStorage; signed-in users write through `RemoteStore` (Supabase, RLS-enforced).
- `src/lib/library/sync.ts` — AniList ⇄ KAZE reconciliation: one-sided changes win; two-sided conflicts merge (max progress, newest status) and are shown in a preview before anything is written.
- `src/lib/recommend.ts` — explainable rule-based recommendations (genre affinity, AniList fan recommendations, community score); every card states its reason.
- `src/lib/watch-party/sync.ts` — server-authoritative sync: host writes via `watch_party_control` RPC (server timestamp); clients estimate clock offset (best-of-5 RTT) and correct drift by rate nudging (>0.15s) or seeking (>1s). Each participant streams their own authorized source.
- Themes: semantic tokens in `globals.css` per `[data-theme]` (palette, radii, shadows, type, motifs) plus motion personalities in `src/lib/themes.ts`; an inline boot script prevents theme flash; settings sync to `user_settings` for signed-in users.

## Known limitations / roadmap

- No live Supabase project was available while building, so auth, social, watch parties and AniList OAuth are implemented and type-checked but **not exercised end-to-end**. Verify against a real project before relying on them.
- E2E: 7 of 9 pass. Failing: the mobile tab-bar click test (Playwright reports `<main>` intercepting the tap on Pixel 7 emulation — unresolved) and the command-palette test (presses Ctrl+K before hydration; needs a hydration wait).
- Demo skip-intro/credits markers are approximate catalog metadata.
- Rate limiting is in-memory (per instance); use Redis for multi-instance deploys.
- CSP uses `'unsafe-inline'` for scripts (Next bootstrap + theme script); move to nonces if you need strict CSP.
- Unknown `/anime/<id>` renders the not-found UI inside a streamed 200 (partial prerendering).
- Achievements for reviews/hosted parties aren't counted yet; seasonal goals are device-local.
- No moderation console yet (tables, reports and `moderators` RLS are in place).
