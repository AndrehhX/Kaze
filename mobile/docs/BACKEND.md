# KAZE backend integration guide

KAZE Mobile works fully in **guest mode** with no backend. Accounts, friends, community,
cloud library sync and online watch parties need a Supabase project. AniList account
linking needs an AniList API client.

> The KAZE Web repository (`C:\Users\Andreh\Desktop\crunchy`) was **not present** when this app
> was built, so its schema could not be inspected. `supabase/migrations/20261101000000_kaze_core.sql`
> is therefore a documented **contract**, designed so web and mobile can share one project.
> Before applying it to an existing KAZE Web project, run the compatibility checklist below.

## 1. Supabase

1. Create a project at supabase.com (or reuse KAZE Web's).
2. Apply the migration:
   ```bash
   supabase db push            # or paste the SQL file into the SQL editor
   ```
3. **Auth → URL configuration → Redirect URLs**: add `kaze://auth-callback`.
4. **Auth → Providers → Email**: keep "Confirm email" on (recommended). The app uses the PKCE
   flow for confirmation and password-reset links.
5. Put the *public* values in `local.properties` (never commit this file):
   ```properties
   SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   SUPABASE_ANON_KEY=eyJ...   # anon/public key only
   ```
6. Rebuild: `gradlew assembleDebug`.

**Never** put the `service_role` key, database password or JWT secret in the app or in
`local.properties`. All data access is protected by Row Level Security and the user's JWT.

### What the schema provides
| Area | Tables / RPCs |
|---|---|
| Profiles | `profiles` (auto-created on sign-up from the chosen username), privacy flags |
| Friends | `friend_requests`, `friendships`, `blocks`; RPCs `send_friend_request`, `respond_friend_request`, `cancel_friend_request`, `remove_friend`, `block_user`, `unblock_user`, `mutual_friends`, `are_friends` |
| Library | `library_entries` (cloud copy of the device library; same shape KAZE Web can read) |
| Activity | `activities` (visible to friends only when `show_activity`) |
| Community | `reviews`, `discussions`, `comments` (threaded via `parent_id`), `likes` + `toggle_like`, `reports` |
| Notifications | `notifications` written by triggers/RPCs (requests, accepts, replies, likes, party invites) |
| Watch parties | `watch_parties` (server-authoritative state), `party_members`, `party_messages`, `party_invites`; RPCs `create_party`, `join_party`, `party_update_state` (host only, server-stamped time), `party_heartbeat`, `leave_party` (host hand-off), `invite_to_party`, `server_now` |
| Account | `delete_my_account` (cascades everything) |

Realtime is enabled for `watch_parties`, `party_messages`, `notifications`, `friend_requests`.
Party presence and emoji reactions use Realtime presence/broadcast on channel `party:<id>`.

### Compatibility checklist (when KAZE Web already has a schema)
- Identity: both apps must use the same `auth.users`; do not create a second user table.
- Compare `profiles` columns; if Web uses other names, add a view or adapt `data/backend/*` rather than duplicating tables.
- Library statuses here are `WATCHING, COMPLETED, PLANNING, PAUSED, DROPPED, REWATCHING`; scores are 0–100.
- Watch-party protocol: state = (`is_playing`, `position_ms`, `playback_rate`, `episode`, `state_updated_at` set by the DB). Clients compute `expected = position + (server_now − state_updated_at) × rate`.
- Keep every table's RLS enabled; review policies after merging.

## 2. AniList account linking

1. Create a client at https://anilist.co/settings/developer.
2. Redirect URL: `kaze://anilist-callback`.
3. `local.properties`: `ANILIST_CLIENT_ID=12345` (the client **ID** only — no secret).

The app uses AniList's implicit grant (designed for apps without a server): the user signs in
on anilist.co in a Custom Tab; the token returns in the URL fragment; the app accepts it only
while a flow it started is pending and only after AniList confirms it via the `Viewer` query.
Tokens are stored encrypted with the Android Keystore. If AniList later rejects the token, the
link is removed and the user is asked to reconnect.

If you prefer the authorization-code grant, implement a small server endpoint that exchanges the
code with the client secret **server-side** and returns the token; the app's
`AniListAuthRepository.handle()` is the single place to change.

## 3. Push notifications (not implemented — contract)
Notifications are delivered today by an hourly WorkManager job (`KazeRefreshWorker`) that reads
unread rows from `notifications` and the AniList airing schedule. For instant push:
1. Add Firebase Cloud Messaging to the app and store each device token in a `device_tokens(user_id, token, platform)` table (RLS: owner only).
2. Add a Supabase Edge Function (or database webhook) on `notifications` INSERT that sends an FCM message with `data.deep_link` (`kaze://notifications`, `kaze://party/CODE`, `kaze://anime/ID`).
3. In the app, post it through `NotificationHelper.post(...)` — channels, grouping and deep links already exist.

## 4. Real licensed playback (not implemented — contract)
`domain/playback/MediaProvider` is the seam. A licensed provider would:
1. Ask the provider's backend for an entitlement for (user, anime, episode) → `PlaybackEntitlement.Licensed`.
2. Return a `PlaybackSource` with the provider's stream URL (and DRM configuration via Media3 if required by the license).
3. Supply skip markers from the provider's metadata.
Bind it in `core/di/AppModule.BindingsModule` instead of `DemoMediaProvider`. Never derive
streams from AniList metadata, scrapers, or another user's device.
