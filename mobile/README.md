# KAZE — Your Anime Universe. Everywhere.

Native Android anime app in Kotlin + Jetpack Compose: a live AniList catalogue, an offline-first
personal library, a Media3 player, four complete visual themes, and (with a Supabase backend)
accounts, friends, community and synchronized watch parties.

**Honest status of every feature:** [docs/STATUS.md](docs/STATUS.md) ·
**Backend setup:** [docs/BACKEND.md](docs/BACKEND.md)

## Build

Requirements: JDK 17, Android SDK platform 35 + build-tools 35 (set `sdk.dir` in `local.properties`).

```bash
./gradlew assembleDebug        # Windows: gradlew.bat assembleDebug
```

Output: `app/build/outputs/apk/debug/app-debug.apk` (application id `com.kaze.mobile`, label "KAZE",
minSdk 26, targetSdk 35).

```bash
./gradlew testDebugUnitTest    # 51 JVM/Robolectric tests; AppSmokeTest needs internet (live AniList)
./gradlew connectedDebugAndroidTest   # on-device tests (Android Keystore); needs a device or emulator
./gradlew testDebugUnitTest --tests "*ScreenshotCapture*" -Pkaze.screenshots=true   # renders screens to app/build/screenshots
```

Install on a device: `adb install -r app/build/outputs/apk/debug/app-debug.apk`

### Optional configuration (`local.properties`, never committed)
```properties
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=...          # public anon key only
ANILIST_CLIENT_ID=...          # AniList client id (no secret)
```
Without these the app runs in guest mode: browsing, discovery, demo playback, local library,
progress, themes and a local watch-party demo all work.

## Architecture

Single Gradle module, feature-oriented packages, MVVM with unidirectional data flow, Hilt DI.

```
core/        designsystem (themes, tokens, motion, components), database (Room), datastore,
             network, security (Keystore token store), text (safe rich text), di
domain/      models, recommendation engine, Anime DNA, sync planner, party sync, playback contracts, social models
data/        anilist (GraphQL client + cached repository), library (Room repos), playback (demo provider),
             backend (Supabase REST/auth, Realtime, social, parties, AniList OAuth, cloud sync)
feature/     home, discover, detail, player, library, profile, community, social, party, auth, settings, onboarding
navigation/  type-safe routes, adaptive shell (animated bottom bar / tablet rail), deep links
notifications/ channels + WorkManager refresh
```

Key decisions
- **AniList over plain OkHttp + kotlinx.serialization** with hand-written typed queries (no schema
  download step). The home screen is one batched GraphQL request using aliases. Unset variables are
  omitted (AniList treats explicit `null` as a filter).
- **Room is the library's source of truth.** Sync (AniList or KAZE cloud) goes through a three-way
  planner; when both sides changed, the user picks — progress is never silently overwritten.
- **Playback is separated from metadata.** `MediaProvider` → `PlaybackEntitlement` → `PlaybackSource`.
  Only an authorized demo provider ships. No scraping, no DRM circumvention.
- **Watch parties are server-authoritative.** The database stamps state time; clients estimate clock
  offset (NTP-style) and correct drift by seeking or nudging playback rate ±8 %. Each member streams
  independently; nothing is relayed between devices.
- **Supabase without the SDK**: GoTrue (PKCE), PostgREST and the Realtime Phoenix protocol over
  OkHttp, always with the user's JWT so Row Level Security applies.

## Themes
| Midnight Neon | Sakura Dream | Cyber Pulse | Zen Studio |
|---|---|---|---|
| Glow surfaces, spring motion, perspective grid | Soft cards, drifting petals, gentle motion | Cut corners, monospace labels, scanlines, directional motion | Serif editorial type, hairlines, ensō, minimal fades |

Themes animate token-by-token, follow system light/dark if desired, support Material You accent
(Android 12+), high contrast and reduced motion (also honoured from Android's animator scale).

## Signature interactions
Cinematic hero (parallax + per-theme title choreography), poster→detail shared-element expansion,
animated theme switching, Anime Roulette reel, profile reveal, player fullscreen/PiP, completion
celebration, themed navigation indicator, spoiler reveal, floating watch-party reactions.

## Release signing
Debug builds use the SDK debug key. For release, create a keystore outside the repo and supply it
via environment variables / CI secrets in a `signingConfigs` block — never commit `*.jks` (already
in `.gitignore`). Release builds enable R8 minification and resource shrinking.

## Content & licences
Metadata, artwork and reviews come from the AniList API and belong to their owners. Demo video:
*Tears of Steel* and *Big Buck Bunny* © Blender Foundation (CC BY 3.0) and Apple's HLS example
stream. KAZE does not host or stream anime.
