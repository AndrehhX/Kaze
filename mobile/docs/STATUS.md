# KAZE Mobile — feature status (honest report)

Verification methods used:
- **JVM/Robolectric tests** — 51 tests plus 4 opt-in screenshot renders (`gradlew testDebugUnitTest`), all passing.
- **On-device (Android emulator)** — Pixel 7 AVD, Android 15 (API 35, x86_64, WHPX acceleration), 2026-11-01:
  the debug APK was installed and driven by hand through every flow below, and 4 instrumented tests
  (`gradlew connectedDebugAndroidTest`) ran on it. No physical phone has been tested yet.
- **E2E smoke** — `AppSmokeTest` boots the real app (production Hilt graph, Room, DataStore, WorkManager) under Robolectric and drives it against the **live AniList API**.
- **Rendered screenshots** — `ScreenshotCapture` (opt-in) renders real screens per theme; reviewed and used to fix layout defects.
- **Not verified**: physical hardware (real GPU/decoders, touch gestures on glass, OEM battery managers), tablets, Android 8–14.

## Implemented and tested
| Feature | Evidence |
|---|---|
| AniList GraphQL client, typed models, batched home query, search, detail, graph, reviews | MockWebServer tests + live E2E (home, search "Frieren", detail with characters) |
| Caching / offline browsing (stale-while-revalidate in Room), retry/backoff, 429 Retry-After | MockWebServer tests |
| Onboarding, Home rails, Discover, Mood Explorer, Search, Detail, Library add, Profile, Settings, Appearance | E2E smoke + screenshots |
| Four themes changing shapes, typography, motion, ornament (not just colour) | Compose UI test + screenshots (Neon, Zen reviewed) |
| Local library (Room): statuses, progress → auto-complete, scores, favourites, bulk ops, collections, import/export merge | Room tests |
| Sync planner (AniList & cloud): three-way merge, conflicts never auto-overwritten | Unit tests |
| Watch-party sync engine: expected position, seek/rate drift correction, clock offset | Unit tests |
| Explainable recommendations, Anime DNA, moods, roulette randomness, achievements | Unit tests |
| Safe text (HTML reduction, inline spoilers, control/bidi stripping), deep-link whitelist, PKCE | Robolectric tests |
| Spoiler shield, theme switching, bottom navigation, error/retry states | Compose UI tests |

## Verified on the emulator (Android 15)
| Feature | What was checked |
|---|---|
| Install & launch | `adb install` succeeds; cold start ~11 s on the emulator; no crashes in logcat across the session |
| Onboarding → Home | Theme pick, genres, live AniList home rails |
| Search, detail, library | Search "Frieren" → detail → add as Watching → progress 2/28 → Library tab; data survives force-stop and reinstall |
| Media3 playback | HLS loads, hardware H.264 decode, ABR switches 1000k → 2200k, Blender subtitles render, MediaSession reaches PLAYING |
| Resume & rotation | "Resume EP 1" restarts at the saved position; playback continues through rotation without restarting |
| Fullscreen | Phone landscape goes fullscreen with system bars hidden |
| Picture-in-Picture | Home during playback auto-enters PiP; video keeps playing in the floating window |
| Deep links | `kaze://anime/<id>` opens the right page from a cold start |
| Notifications | POST_NOTIFICATIONS request from Settings; the WorkManager job is scheduled (network + battery-not-low); a forced run read the real AniList airing schedule and posted "Dragon Ball Super: Beerus · Episode 4"; tapping it opens that anime |
| Android Keystore | Instrumented tests: key available, round trip, only ciphertext on disk, survives a new instance, tampered data dropped without a crash |
| Theme persistence | Chosen theme survives reinstall |

Bugs found on the emulator and fixed:
- Phones in landscape got the tablet two-pane player instead of fullscreen (a Pixel 7 is ~914 dp wide in landscape; the check now also requires `smallestScreenWidthDp ≥ 600`).
- Player status-bar icons were dark on the dark player when the system used light mode.
- Opening the player for a moment put the title in "Continue watching" (progress under 10 s is no longer saved for a new episode; regression test added).
- Status labels drawn on artwork (library, home rails, episodes, cast) were unreadable; they now have a dark backing.
- The light-theme hero text faded into busy artwork; scrims are denser on light themes.
- The bottom bar was 96 % opaque, so large headings showed through; it is now solid.
- Notifications used the full-colour launcher layer as the status-bar icon; there is now a monochrome `ic_stat_kaze`.
- "1 titles" pluralisation.

## Implemented, not externally verified
| Feature | Why unverified |
|---|---|
| Supabase auth (sign-up, PKCE email links, sign-in, refresh, reset, resend, sign-out, delete account) | No Supabase project configured in this environment |
| Friends, requests, blocks, mutual friends, profiles, privacy, activity feed | Needs a configured backend |
| KAZE reviews, discussions, threaded comments, likes, reports, moderation tables | Needs a configured backend |
| Online watch parties over Supabase Realtime (presence, chat, reactions, invites, host hand-off, expiry, reconnect) | Needs a configured backend + two devices |
| SQL migration and RLS policies | Not executed against Postgres here |
| AniList OAuth link, list/favourite import, progress push | Needs an AniList client id and account |
| Player extras: manual quality/audio/subtitle menus, swipe/pinch/hold gestures, ambient lighting, auto-next | Playback itself is verified on the emulator; these controls were not each exercised |
| Social/party notifications | Need a configured backend (the episode notification path is verified) |
| Merged manifest permissions | WAKE_LOCK, RECEIVE_BOOT_COMPLETED, FOREGROUND_SERVICE come from WorkManager, not app code |
| Tablet layouts (nav rail, two-pane detail, wide player) | Not rendered at tablet sizes yet |

## Demo-only
| Feature | Notes |
|---|---|
| Video content | `DemoMediaProvider` plays openly licensed Blender films (CC BY 3.0) and Apple's HLS test stream **in place of** anime episodes; every player screen says so |
| Skip intro/credits markers | Hand-authored for the demo films, labelled "Demo markers" |
| Local watch-party room | In-memory "server" for trying the sync engine without a backend; labelled "Local demo — not connected to anyone" |

## Not implemented
- Licensed anime streaming (no provider/entitlements exist; contract in `docs/BACKEND.md`).
- Offline video downloads (no authorized downloadable media).
- Firebase Cloud Messaging push (contract documented; polling via WorkManager instead).
- Image upload for avatars/banners (profile accepts https image URLs).
- Moderator console (reports are stored; review happens in Supabase).
- Macrobenchmark / baseline profiles; UI instrumentation tests on device (only the Keystore suite runs on device).
- Release signing configuration (see README).

## Known issues / limitations
- AniList enforces a per-minute rate limit; very fast navigation can surface "rate-limited" states (handled with retry/backoff).
- Similarity Explorer opened from Discover starts at a fixed title (Frieren) — open it from any anime page to start there.
- Search history and genre preferences are device-local even when signed in.
- Collections are local; only library entries sync to the cloud.
