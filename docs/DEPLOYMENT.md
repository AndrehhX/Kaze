# Deploying KAZE

KAZE is a standard Next.js 16 app. It runs on any Node 20.9+ host (Vercel, a container, a VM). Supabase is optional but required for accounts and social features.

## 1. Supabase

1. Create a project at supabase.com.
2. Apply the schema, using either:
   - **SQL editor:** run `supabase/migrations/20261029000000_kaze_schema.sql`, then `supabase/seed.sql`;
   - **CLI:** `supabase link --project-ref <ref>`, then `supabase db push`, then run `seed.sql`.
3. **Auth → URL Configuration**
   - Site URL: `https://your-domain`
   - Redirect URLs: `https://your-domain/auth/callback`
4. **Auth → Email:** keep "Confirm email" on. Configure SMTP for production volumes; Supabase's built-in sender is heavily rate-limited.
5. **Database → Replication:** the migration adds `notifications`, `watch_party_rooms`, `watch_party_messages` and `watch_party_participants` to `supabase_realtime`. Confirm they are listed.
6. **Storage:** the migration creates the public `profile-media` bucket (3 MB, images only) with per-user folder policies.
7. Optional: grant moderation rights with `insert into public.moderators (user_id) values ('<uuid>');`.

## 2. AniList OAuth (optional)

1. anilist.co/settings/developer → Create client.
2. Redirect URL: `https://your-domain/api/integrations/anilist/callback`.
3. Generate an encryption key:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

## 3. Environment variables

| Variable | Scope | Required for |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | public | Correct OAuth redirect URIs and metadata |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Accounts, sync, social |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | AniList token storage, full account deletion |
| `NEXT_PUBLIC_ANILIST_CLIENT_ID`, `ANILIST_CLIENT_SECRET` | public / **server only** | AniList connection |
| `TOKEN_ENCRYPTION_KEY` | **server only** | Encrypting AniList tokens at rest |

`NEXT_PUBLIC_*` values are inlined at **build** time, so rebuild after changing them. Never put the service-role key or client secret in a `NEXT_PUBLIC_` variable.

## 4. Build and run

```bash
npm ci
npm run typecheck && npm run lint && npm test
npm run build
npm start            # or deploy to Vercel
```

On Vercel, import the repository, add the variables above, and deploy. No extra configuration is needed: the proxy (`src/proxy.ts`) refreshes Supabase sessions automatically.

## 5. Production checklist

- [ ] Migration and seed applied; Realtime tables listed.
- [ ] Auth redirect URL set; SMTP configured.
- [ ] `NEXT_PUBLIC_SITE_URL` matches the deployed origin.
- [ ] Service-role key and secrets set as server-only variables.
- [ ] `npm run test:e2e` passes against a preview deployment (`PORT`/`baseURL`).
- [ ] Multiple instances: replace the in-memory rate limiter (`src/lib/rate-limit.ts`) with Redis/Upstash.
- [ ] Strict CSP needed? Move from `'unsafe-inline'` to nonces (makes every page dynamic).
- [ ] Licensed media: implement a `MediaProvider` and add its CDN hosts to `media-src`/`connect-src` in `next.config.ts`.
- [ ] Monitoring: forward server logs (no tokens are logged) and track AniList 429/503 responses from `/api/anilist/*`.
