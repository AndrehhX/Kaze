# KAZE architecture

## Principles

1. **Real data only.** Public anime metadata comes from AniList; everything a user creates lives in their own browser (guest) or in Supabase (account). Nothing is invented: no fake users, reviews, activity, episode titles or thumbnails.
2. **Metadata ≠ rights.** AniList listing a title never makes it playable. Playback requires a provider-confirmed entitlement; today the only provider is the open-licensed demo catalog.
3. **The server is the authority.** Access control is enforced by Postgres Row Level Security and `SECURITY DEFINER` functions, never only by the UI. Third-party tokens never reach the browser.
4. **Works without configuration.** Every integration is optional and reports "not configured" honestly instead of failing.

## Layers

```
Browser ─┬─ Server Components (AniList reads, "use cache")      src/app/(site)/**/page.tsx
         ├─ Route Handlers (rate-limited proxies, OAuth, grants) src/app/api/**
         ├─ Client stores (Zustand, persisted)                   src/stores/*
         └─ Supabase JS (user JWT, RLS)                          src/lib/data/remote.ts, src/lib/social.ts
                     │
Supabase ────────────┴─ Postgres + RLS + triggers + RPCs         supabase/migrations/*
                        Realtime (notifications, rooms, chat), Storage (avatars/banners)
```

### Rendering (Next.js 16, Cache Components)

- `cacheComponents` and `partialPrefetching` are on. AniList reads are `"use cache"` functions with `cacheLife` profiles (`src/lib/anilist/service.ts`), so the home page and `/discover` prerender into the static shell and AniList sees a handful of requests per hour, not per visitor.
- Anything that reads runtime data (`params`, `searchParams`, cookies) sits behind a `Suspense` boundary or `loading.tsx`, giving every route a skeleton.
- Navigation chrome never waits for runtime data: `PathnameSync` (in its own Suspense boundary) mirrors `usePathname()` into a store, so the header and mobile bar render immediately and only the active highlight streams in.
- The theme is applied by an inline script in `<head>` before first paint (`themeBootScript`), so there is no flash of the wrong theme.

### AniList

- `client.ts` – POST transport with in-flight de-duplication (anonymous requests only), bounded retries on 429/5xx honouring `Retry-After`, and no logging of `Authorization` headers.
- `queries.ts` – typed fragments. The home page is **one** aliased query (trending, season, top, gems, upcoming, favourites, airing schedule).
- `browse-params.ts` – Zod-validated URL ⇄ filter mapping. Invalid values are dropped one by one, never thrown.
- Client components call `/api/anilist/*` (per-IP rate limits, `Cache-Control` headers) rather than AniList directly.

### Persistence

| Data | Guest | Signed in |
| --- | --- | --- |
| Library, collections | `localStorage` (`kaze:library`) | `anime_library_entries`, `library_notes` (private), `anime_collections`, `collection_items` |
| Watch progress | `kaze:progress` | `watch_progress` (throttled writes, flushed on pause/hide/unload) |
| Settings & theme | `kaze:settings` + `kaze:theme` | `user_settings` (debounced, newest-wins) |
| Not-interested list | `kaze:local` | `recommendation_preferences` |
| Achievements, seasonal goal | computed / `localStorage` | `user_achievements`, `seasonal_goals` |

Stores apply changes optimistically and write through `RemoteStore` when a session exists. On sign-in, data saved as a guest is offered for import; on sign-out, account data is removed from the device.

### AniList account sync

OAuth authorization-code flow with a `state` cookie bound to the user (`/api/integrations/anilist/start|callback`). The access token is AES-256-GCM encrypted (`src/lib/crypto.ts`) into `connected_account_secrets`, a table with RLS enabled and **no policies** (service role only). List reads and writes go through server routes; the browser never sees the token.

Reconciliation (`src/lib/library/sync.ts`) is pure and unit-tested:

- entry on one side only → import / export;
- changed on one side since the last sync → that side wins;
- changed on both → merge (max progress, newest status, keep a score/notes that exists on only one side) and report the conflict.

The settings page shows the full plan before anything is written. Writes to AniList are paced (≤25 per call, 700 ms apart) and stop on a 429.

### Playback

`MediaProvider` (`src/lib/media/types.ts`) separates catalog, assets, entitlements and sessions. `POST /api/playback/session` checks the entitlement server-side and returns a short-lived grant (asset URL, subtitles, timing markers, episode list) and records a `playback_sessions` row for signed-in users. To add a licensed source, implement `MediaProvider` and register it in `src/lib/media/provider.ts`.

The player (`src/components/player`) uses hls.js where MSE exists and native HLS on Safari. Captions are rendered by KAZE (not the browser) so they can be styled and shifted in time; cue maths lives in `captions.ts`.

### Watch parties

- The room row is the single source of truth. Only the host can change it, through the `watch_party_control` RPC, which stamps `state_updated_at` with the **database clock** and bumps `state_version`.
- Clients estimate their offset to that clock with `server_time()` (best of 5 by round-trip time) and extrapolate the expected position.
- Drift under 0.15 s is ignored, up to 1 s is absorbed by nudging `playbackRate` ±5 %, and beyond that the client seeks (`src/lib/watch-party/sync.ts`).
- The host re-anchors every 10 s; clients re-sync after any reconnection.
- Every participant streams from their own authorized grant: nothing is relayed between viewers, and a participant without an entitlement sees an explanation instead of the player.
- Chat and participants use Postgres changes; reactions and presence use Realtime broadcast/presence.

### Recommendations

`src/lib/recommend.ts` is rule-based and explainable: genre affinity from your library (weighted by status, score and favourites), AniList fan recommendations for your top-rated titles, community score and a small popularity nudge. Each result carries the strongest factor as its reason, and titles you marked "Not interested" are excluded. `scoreCandidate` is the seam for a future learned model.

### Themes and motion

Semantic tokens (`--k-*`) per `[data-theme]` in `globals.css` cover palette, surfaces, radii, shadows, focus rings, typography and motifs (chamfered cards and scan lines for Cyber, paper grain and framed posters for Zen, and so on). `THEMES[*].motion` gives each theme its own spring, easing, distance and stagger, consumed through `useKazeMotion()`. Reduced motion is respected through CSS and `MotionConfig`, and users can override it in settings.

## Security summary

- RLS on every table; privacy facets enforced by `can_view(owner, facet)`; blocks enforced in profile, review, discussion, comment and room policies.
- Counters (`like_count`, `comment_count`) are maintained by triggers, and insert policies reject forged values.
- Watch-party guests cannot control playback or promote themselves to host.
- Inputs are validated by Zod (client and server) plus database `CHECK` constraints. User content is rendered as text (no HTML injection).
- Redirects go only to same-origin relative paths (`safeRedirectPath`). The OAuth `state` is compared in constant time.
- CSP, HSTS (in production), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` and `Permissions-Policy` are set in `next.config.ts`.
- Uploads: bucket-level MIME and size limits plus per-user folder policies.

## Testing

| Suite | What it covers |
| --- | --- |
| `tests/unit` (Vitest + RTL) | sync reconciliation, drift correction, recommendations, filters, captions, redirects, episodes, DNA/achievements, stores, spoiler/rating components |
| `tests/db` (Vitest + PGlite) | the real migration and seed in embedded Postgres behind a Supabase shim: RLS for every privacy facet, secrets isolation, friend/block flows, triggers, moderation, watch-party control, role escalation, cascade deletion |
| `tests/e2e` (Playwright) | hero and data, theme persistence without flash, URL filters, library persistence, HLS playback and progress, unlicensed titles not streamed, command palette, mobile layout and navigation, accessibility (axe) |
