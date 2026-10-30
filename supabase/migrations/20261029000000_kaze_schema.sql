-- ════════════════════════════════════════════════════════════════════
-- KAZE — core schema
-- AniList ids are stored as external identifiers (integer media_id);
-- AniList metadata is not mirrored beyond small display snapshots.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists citext;
create extension if not exists pgcrypto;

-- ── Profiles ─────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username citext not null unique check (username ~ '^[a-zA-Z0-9_]{3,24}$'),
  display_name text not null default '' check (char_length(display_name) <= 48),
  bio text not null default '' check (char_length(bio) <= 600),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  banner_url text check (banner_url is null or banner_url ~ '^https://'),
  profile_theme text not null default 'midnight' check (profile_theme in ('midnight', 'sakura', 'cyber', 'zen')),
  favorite_genres text[] not null default '{}' check (cardinality(favorite_genres) <= 10),
  favorite_anime integer[] not null default '{}' check (cardinality(favorite_anime) <= 24),
  favorite_characters jsonb not null default '[]'::jsonb,
  -- privacy
  visibility text not null default 'public' check (visibility in ('public', 'friends', 'private')),
  show_watch_history boolean not null default true,
  show_favorites boolean not null default true,
  show_activity boolean not null default true,
  show_lists boolean not null default true,
  show_online_status boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme text not null default 'midnight' check (theme in ('midnight', 'sakura', 'cyber', 'zen')),
  motion text not null default 'system' check (motion in ('system', 'reduce', 'full')),
  ambient_effects boolean not null default true,
  gamification_enabled boolean not null default true,
  player jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ── Connected services (AniList) ─────────────────────────────────────
create table public.connected_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('anilist')),
  external_user_id text not null,
  external_username text not null,
  external_avatar_url text,
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  last_sync_status text check (last_sync_status in ('ok', 'partial', 'error')),
  last_sync_message text,
  unique (user_id, provider),
  unique (provider, external_user_id)
);

-- Encrypted tokens. RLS enabled with NO policies: only the service role can read/write.
create table public.connected_account_secrets (
  account_id uuid primary key references public.connected_accounts (id) on delete cascade,
  encrypted_token text not null,
  token_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ── Social graph ─────────────────────────────────────────────────────
create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (sender_id <> receiver_id)
);
create unique index friend_requests_one_pending on public.friend_requests (least(sender_id, receiver_id), greatest(sender_id, receiver_id)) where status = 'pending';
create index friend_requests_receiver on public.friend_requests (receiver_id, status);
create index friend_requests_sender on public.friend_requests (sender_id, status);

create table public.friendships (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index friendships_b on public.friendships (user_b);

create table public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index user_blocks_blocked on public.user_blocks (blocked_id);

-- ── Library ──────────────────────────────────────────────────────────
create table public.anime_library_entries (
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_id integer not null check (media_id > 0),
  status text not null check (status in ('CURRENT', 'PLANNING', 'COMPLETED', 'DROPPED', 'PAUSED', 'REPEATING')),
  progress integer not null default 0 check (progress >= 0 and progress <= 10000),
  score smallint check (score between 1 and 100),
  favorite boolean not null default false,
  started_at date,
  completed_at date,
  repeat smallint not null default 0 check (repeat >= 0),
  media_snapshot jsonb not null default '{}'::jsonb,
  anilist_updated_at timestamptz,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, media_id)
);
create index library_user_status on public.anime_library_entries (user_id, status, updated_at desc);

-- Private notes live apart from entries so public lists never expose them.
create table public.library_notes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_id integer not null,
  notes text not null default '' check (char_length(notes) <= 4000),
  updated_at timestamptz not null default now(),
  primary key (user_id, media_id)
);

create table public.anime_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 400),
  color text not null default '#a855f7' check (color ~ '^#[0-9a-fA-F]{6}$'),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index collections_user on public.anime_collections (user_id, updated_at desc);

create table public.collection_items (
  collection_id uuid not null references public.anime_collections (id) on delete cascade,
  media_id integer not null,
  position integer not null default 0,
  media_snapshot jsonb not null default '{}'::jsonb,
  added_at timestamptz not null default now(),
  primary key (collection_id, media_id)
);

-- ── Playback ─────────────────────────────────────────────────────────
create table public.media_assets (
  id text primary key,
  provider text not null,
  series_id text not null,
  episode_id text not null,
  kind text not null check (kind in ('hls', 'mp4', 'dash')),
  src text not null check (src ~ '^https://'),
  markers jsonb not null default '[]'::jsonb,
  subtitles jsonb not null default '[]'::jsonb,
  duration_seconds integer,
  license text not null,
  created_at timestamptz not null default now(),
  unique (provider, series_id, episode_id)
);

create table public.media_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade, -- null = everyone
  provider text not null,
  series_id text not null,
  reason text not null check (reason in ('demo-open-license', 'licensed', 'subscription', 'promo')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create index entitlements_lookup on public.media_entitlements (provider, series_id, user_id);

create table public.watch_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  series_id text not null,
  episode_id text not null,
  position_seconds real not null default 0 check (position_seconds >= 0),
  duration_seconds real not null default 0 check (duration_seconds >= 0),
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, series_id, episode_id)
);
create index watch_progress_recent on public.watch_progress (user_id, updated_at desc);

create table public.playback_sessions (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null,
  series_id text not null,
  episode_id text not null,
  started_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  ended_at timestamptz
);
create index playback_sessions_user on public.playback_sessions (user_id, started_at desc);

-- ── Community ────────────────────────────────────────────────────────
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_id integer not null,
  media_snapshot jsonb not null default '{}'::jsonb,
  rating smallint not null check (rating between 1 and 10),
  title text not null check (char_length(title) between 3 and 120),
  body text not null check (char_length(body) between 40 and 10000),
  has_spoilers boolean not null default false,
  status text not null default 'published' check (status in ('published', 'hidden', 'removed')),
  like_count integer not null default 0,
  comment_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, media_id)
);
create index reviews_media on public.reviews (media_id, created_at desc) where status = 'published';
create index reviews_recent on public.reviews (created_at desc) where status = 'published';

create table public.review_reactions (
  review_id uuid not null references public.reviews (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'like' check (kind in ('like')),
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

create table public.discussions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_id integer,
  media_snapshot jsonb,
  title text not null check (char_length(title) between 4 and 140),
  body text not null check (char_length(body) between 1 and 8000),
  has_spoilers boolean not null default false,
  status text not null default 'published' check (status in ('published', 'hidden', 'removed', 'locked')),
  comment_count integer not null default 0,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index discussions_recent on public.discussions (last_activity_at desc) where status in ('published', 'locked');
create index discussions_media on public.discussions (media_id, last_activity_at desc);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('review', 'discussion')),
  target_id uuid not null,
  parent_id uuid references public.comments (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  has_spoilers boolean not null default false,
  status text not null default 'published' check (status in ('published', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comments_target on public.comments (target_type, target_id, created_at);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('review', 'discussion', 'comment', 'profile', 'watch_party_message')),
  target_id text not null,
  reason text not null check (reason in ('spam', 'harassment', 'spoilers', 'hate', 'sexual', 'other')),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

-- Moderators: managed manually (service role) — foundation for a moderation console.
create table public.moderators (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ── Activity & notifications ─────────────────────────────────────────
create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('started', 'completed', 'rated', 'favorited', 'reviewed', 'progress')),
  media_id integer,
  media_snapshot jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_user on public.activity_events (user_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('friend_request', 'friend_accepted', 'review_like', 'comment', 'reply', 'watch_party_invite', 'achievement', 'system')),
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user on public.notifications (user_id, created_at desc);

-- ── Watch parties ────────────────────────────────────────────────────
create table public.watch_party_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default encode(gen_random_bytes(6), 'hex'),
  host_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  series_id text not null,
  episode_id text not null,
  is_playing boolean not null default false,
  position_seconds double precision not null default 0,
  playback_rate real not null default 1 check (playback_rate between 0.25 and 2),
  state_updated_at timestamptz not null default now(),
  state_version bigint not null default 0,
  invite_only boolean not null default true,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table public.watch_party_participants (
  room_id uuid not null references public.watch_party_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'guest' check (role in ('host', 'guest')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (room_id, user_id)
);

create table public.watch_party_invites (
  room_id uuid not null references public.watch_party_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  invited_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table public.watch_party_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.watch_party_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index watch_party_messages_room on public.watch_party_messages (room_id, created_at);

-- ── Gamification & personalization ───────────────────────────────────
create table public.achievements (
  id text primary key,
  name text not null,
  description text not null,
  category text not null check (category in ('milestone', 'genre', 'discovery', 'social', 'seasonal')),
  threshold integer not null default 1,
  icon text not null default 'sparkles'
);

create table public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id text not null references public.achievements (id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table public.recommendation_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  preferred_genres text[] not null default '{}',
  excluded_genres text[] not null default '{}',
  excluded_media integer[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.seasonal_goals (
  user_id uuid not null references public.profiles (id) on delete cascade,
  season text not null check (season in ('WINTER', 'SPRING', 'SUMMER', 'FALL')),
  year integer not null,
  target integer not null check (target between 1 and 200),
  created_at timestamptz not null default now(),
  primary key (user_id, season, year)
);

-- ════════════════════════════════════════════════════════════════════
-- Helper functions (SECURITY DEFINER, fixed search_path)
-- ════════════════════════════════════════════════════════════════════

create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from friendships where user_a = least(a, b) and user_b = greatest(a, b));
$$;

create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- Can the current user see `facet` of `owner`'s profile?
create or replace function public.can_view(owner uuid, facet text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  p profiles%rowtype;
  viewer uuid := auth.uid();
begin
  if viewer is not null and viewer = owner then return true; end if;
  select * into p from profiles where id = owner;
  if not found then return false; end if;
  if viewer is not null and is_blocked_between(viewer, owner) then return false; end if;
  if p.visibility = 'private' then return false; end if;
  if p.visibility = 'friends' and (viewer is null or not are_friends(viewer, owner)) then return false; end if;
  return case facet
    when 'profile' then true
    when 'lists' then p.show_lists
    when 'history' then p.show_watch_history
    when 'favorites' then p.show_favorites
    when 'activity' then p.show_activity
    else false
  end;
end;
$$;

create or replace function public.is_moderator() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from moderators where user_id = auth.uid());
$$;

create or replace function public.server_time() returns timestamptz
language sql stable as $$ select clock_timestamp(); $$;

-- ── New user bootstrap ──────────────────────────────────────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)), '[^a-zA-Z0-9_]', '', 'g'));
  if char_length(base) < 3 then base := 'kaze_' || base; end if;
  base := left(base, 20);
  candidate := base;
  while exists (select 1 from profiles where username = candidate) loop
    n := n + 1;
    candidate := left(base, 20) || n::text;
  end loop;
  insert into profiles (id, username, display_name)
  values (new.id, candidate, left(coalesce(new.raw_user_meta_data ->> 'display_name', candidate), 48));
  insert into user_settings (user_id, theme)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'theme', ''), 'midnight'))
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ── updated_at maintenance ──────────────────────────────────────────
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.user_settings for each row execute function public.touch_updated_at();
create trigger collections_touch before update on public.anime_collections for each row execute function public.touch_updated_at();
create trigger reviews_touch before update on public.reviews for each row execute function public.touch_updated_at();
create trigger discussions_touch before update on public.discussions for each row execute function public.touch_updated_at();
create trigger comments_touch before update on public.comments for each row execute function public.touch_updated_at();

-- ── Friend requests ─────────────────────────────────────────────────
create or replace function public.send_friend_request(target uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  req uuid;
  reverse_req uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if me = target then raise exception 'cannot befriend yourself'; end if;
  if is_blocked_between(me, target) then raise exception 'unavailable'; end if;
  if are_friends(me, target) then raise exception 'already friends'; end if;
  -- If they already asked us, accept instead of creating a duplicate.
  select id into reverse_req from friend_requests where sender_id = target and receiver_id = me and status = 'pending';
  if reverse_req is not null then
    perform respond_friend_request(reverse_req, true);
    return reverse_req;
  end if;
  insert into friend_requests (sender_id, receiver_id) values (me, target) returning id into req;
  insert into notifications (user_id, actor_id, kind, payload) values (target, me, 'friend_request', jsonb_build_object('request_id', req));
  return req;
end;
$$;

create or replace function public.respond_friend_request(request_id uuid, accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r friend_requests%rowtype;
begin
  select * into r from friend_requests where id = request_id and status = 'pending' for update;
  if not found then raise exception 'request not found'; end if;
  if r.receiver_id <> me then raise exception 'not allowed'; end if;
  update friend_requests set status = case when accept then 'accepted' else 'rejected' end, responded_at = now() where id = request_id;
  if accept then
    insert into friendships (user_a, user_b) values (least(r.sender_id, r.receiver_id), greatest(r.sender_id, r.receiver_id)) on conflict do nothing;
    insert into notifications (user_id, actor_id, kind, payload) values (r.sender_id, me, 'friend_accepted', '{}'::jsonb);
  end if;
end;
$$;

create or replace function public.remove_friend(other uuid) returns void
language sql security definer set search_path = public as $$
  delete from friendships where user_a = least(auth.uid(), other) and user_b = greatest(auth.uid(), other);
$$;

create or replace function public.block_user(target uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null or me = target then raise exception 'not allowed'; end if;
  insert into user_blocks (blocker_id, blocked_id) values (me, target) on conflict do nothing;
  delete from friendships where user_a = least(me, target) and user_b = greatest(me, target);
  update friend_requests set status = 'cancelled', responded_at = now()
    where status = 'pending' and ((sender_id = me and receiver_id = target) or (sender_id = target and receiver_id = me));
end;
$$;

create or replace function public.mutual_friend_count(other uuid) returns integer
language sql stable security definer set search_path = public as $$
  with mine as (
    select case when user_a = auth.uid() then user_b else user_a end as f from friendships where auth.uid() in (user_a, user_b)
  ), theirs as (
    select case when user_a = other then user_b else user_a end as f from friendships where other in (user_a, user_b)
  )
  select count(*)::int from mine join theirs using (f);
$$;

-- ── Review likes keep a counter and notify the author ───────────────
create or replace function public.on_review_reaction() returns trigger
language plpgsql security definer set search_path = public as $$
declare author uuid;
begin
  if tg_op = 'INSERT' then
    update reviews set like_count = like_count + 1 where id = new.review_id returning user_id into author;
    if author is not null and author <> new.user_id then
      insert into notifications (user_id, actor_id, kind, payload) values (author, new.user_id, 'review_like', jsonb_build_object('review_id', new.review_id));
    end if;
    return new;
  else
    update reviews set like_count = greatest(like_count - 1, 0) where id = old.review_id;
    return old;
  end if;
end;
$$;
create trigger review_reaction_counter after insert or delete on public.review_reactions
for each row execute function public.on_review_reaction();

-- ── Comments bump counters and notify ───────────────────────────────
create or replace function public.on_comment_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
  parent_owner uuid;
begin
  if new.target_type = 'review' then
    update reviews set comment_count = comment_count + 1 where id = new.target_id returning user_id into owner;
  else
    update discussions set comment_count = comment_count + 1, last_activity_at = now() where id = new.target_id returning user_id into owner;
  end if;
  if new.parent_id is not null then
    select user_id into parent_owner from comments where id = new.parent_id;
    if parent_owner is not null and parent_owner <> new.user_id and not is_blocked_between(parent_owner, new.user_id) then
      insert into notifications (user_id, actor_id, kind, payload)
      values (parent_owner, new.user_id, 'reply', jsonb_build_object('comment_id', new.id, 'target_type', new.target_type, 'target_id', new.target_id));
    end if;
  end if;
  if owner is not null and owner <> new.user_id and owner is distinct from parent_owner and not is_blocked_between(owner, new.user_id) then
    insert into notifications (user_id, actor_id, kind, payload)
    values (owner, new.user_id, 'comment', jsonb_build_object('comment_id', new.id, 'target_type', new.target_type, 'target_id', new.target_id));
  end if;
  return new;
end;
$$;
create trigger comment_insert after insert on public.comments for each row execute function public.on_comment_insert();

-- Comments must point at an existing, visible target.
create or replace function public.check_comment_target() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.target_type = 'review' and not exists (select 1 from reviews where id = new.target_id and status = 'published') then
    raise exception 'review not found';
  end if;
  if new.target_type = 'discussion' and not exists (select 1 from discussions where id = new.target_id and status = 'published') then
    raise exception 'discussion not found or locked';
  end if;
  if new.parent_id is not null and not exists (select 1 from comments where id = new.parent_id and target_id = new.target_id) then
    raise exception 'parent mismatch';
  end if;
  return new;
end;
$$;
create trigger comment_target_check before insert on public.comments for each row execute function public.check_comment_target();

-- ── Activity feed from real library events ──────────────────────────
create or replace function public.on_library_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.status in ('CURRENT', 'REPEATING') then
    insert into activity_events (user_id, kind, media_id, media_snapshot) values (new.user_id, 'started', new.media_id, new.media_snapshot);
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status = 'COMPLETED' then
    insert into activity_events (user_id, kind, media_id, media_snapshot, payload)
    values (new.user_id, 'completed', new.media_id, new.media_snapshot, jsonb_build_object('score', new.score));
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('CURRENT', 'REPEATING') and old.status not in ('CURRENT', 'REPEATING') then
    insert into activity_events (user_id, kind, media_id, media_snapshot) values (new.user_id, 'started', new.media_id, new.media_snapshot);
  end if;
  if tg_op = 'UPDATE' and new.score is distinct from old.score and new.score is not null then
    insert into activity_events (user_id, kind, media_id, media_snapshot, payload)
    values (new.user_id, 'rated', new.media_id, new.media_snapshot, jsonb_build_object('score', new.score));
  end if;
  if (tg_op = 'INSERT' and new.favorite) or (tg_op = 'UPDATE' and new.favorite and not old.favorite) then
    insert into activity_events (user_id, kind, media_id, media_snapshot) values (new.user_id, 'favorited', new.media_id, new.media_snapshot);
  end if;
  return new;
end;
$$;
create trigger library_activity after insert or update on public.anime_library_entries
for each row execute function public.on_library_change();

create or replace function public.on_review_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into activity_events (user_id, kind, media_id, media_snapshot, payload)
  values (new.user_id, 'reviewed', new.media_id, new.media_snapshot, jsonb_build_object('review_id', new.id, 'rating', new.rating));
  return new;
end;
$$;
create trigger review_activity after insert on public.reviews for each row execute function public.on_review_insert();

-- ── Watch party control (server-authoritative clock) ────────────────
create or replace function public.watch_party_control(room uuid, playing boolean, pos double precision, episode text default null, rate real default null)
returns public.watch_party_rooms
language plpgsql security definer set search_path = public as $$
declare r watch_party_rooms%rowtype;
begin
  select * into r from watch_party_rooms where id = room for update;
  if not found or r.ended_at is not null then raise exception 'room not found'; end if;
  if r.host_id <> auth.uid() then raise exception 'only the host controls playback'; end if;
  update watch_party_rooms set
    is_playing = playing,
    position_seconds = greatest(pos, 0),
    episode_id = coalesce(episode, episode_id),
    playback_rate = coalesce(rate, playback_rate),
    state_updated_at = clock_timestamp(),
    state_version = state_version + 1
  where id = room returning * into r;
  return r;
end;
$$;

create or replace function public.can_join_room(room uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from watch_party_rooms r
    where r.id = room and r.ended_at is null and auth.uid() is not null
      and not is_blocked_between(auth.uid(), r.host_id)
      and (
        r.host_id = auth.uid()
        or not r.invite_only
        or are_friends(auth.uid(), r.host_id)
        or exists (select 1 from watch_party_invites i where i.room_id = r.id and i.user_id = auth.uid())
      )
  );
$$;

create or replace function public.is_room_member(room uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from watch_party_participants where room_id = room and user_id = auth.uid() and left_at is null)
      or exists (select 1 from watch_party_rooms where id = room and host_id = auth.uid());
$$;

create or replace function public.on_room_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into watch_party_participants (room_id, user_id, role) values (new.id, new.host_id, 'host') on conflict do nothing;
  return new;
end;
$$;
create trigger room_created after insert on public.watch_party_rooms for each row execute function public.on_room_created();

create or replace function public.on_invite_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, actor_id, kind, payload)
  select new.user_id, new.invited_by, 'watch_party_invite', jsonb_build_object('room_id', new.room_id, 'title', r.title)
  from watch_party_rooms r where r.id = new.room_id;
  return new;
end;
$$;
create trigger invite_created after insert on public.watch_party_invites for each row execute function public.on_invite_created();

-- ── Account deletion helper (called by the server with the user's JWT) ──
create or replace function public.delete_my_data() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from profiles where id = auth.uid();
end;
$$;

-- ════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ════════════════════════════════════════════════════════════════════
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.connected_accounts enable row level security;
alter table public.connected_account_secrets enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.user_blocks enable row level security;
alter table public.anime_library_entries enable row level security;
alter table public.library_notes enable row level security;
alter table public.anime_collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.media_assets enable row level security;
alter table public.media_entitlements enable row level security;
alter table public.watch_progress enable row level security;
alter table public.playback_sessions enable row level security;
alter table public.reviews enable row level security;
alter table public.review_reactions enable row level security;
alter table public.discussions enable row level security;
alter table public.comments enable row level security;
alter table public.reports enable row level security;
alter table public.moderators enable row level security;
alter table public.activity_events enable row level security;
alter table public.notifications enable row level security;
alter table public.watch_party_rooms enable row level security;
alter table public.watch_party_participants enable row level security;
alter table public.watch_party_invites enable row level security;
alter table public.watch_party_messages enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.recommendation_preferences enable row level security;
alter table public.seasonal_goals enable row level security;

-- profiles: discoverable unless private/blocked; editable by owner only.
create policy profiles_read on public.profiles for select
  using (id = auth.uid() or (not public.is_blocked_between(auth.uid(), id) and (visibility <> 'private' or public.are_friends(auth.uid(), id))));
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy settings_owner on public.user_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy connected_owner_read on public.connected_accounts for select using (user_id = auth.uid());
create policy connected_owner_delete on public.connected_accounts for delete using (user_id = auth.uid());
-- (inserts/updates happen server-side with the service role after OAuth)

create policy fr_read on public.friend_requests for select using (auth.uid() in (sender_id, receiver_id));
create policy fr_cancel on public.friend_requests for update using (sender_id = auth.uid() and status = 'pending') with check (status = 'cancelled');

create policy friendships_read on public.friendships for select
  using (auth.uid() in (user_a, user_b) or (public.can_view(user_a, 'profile') and public.can_view(user_b, 'profile')));

create policy blocks_owner on public.user_blocks for select using (blocker_id = auth.uid());
create policy blocks_delete on public.user_blocks for delete using (blocker_id = auth.uid());

create policy library_read on public.anime_library_entries for select using (public.can_view(user_id, 'lists'));
create policy library_write on public.anime_library_entries for insert with check (user_id = auth.uid());
create policy library_update on public.anime_library_entries for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy library_delete on public.anime_library_entries for delete using (user_id = auth.uid());

create policy notes_owner on public.library_notes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy collections_read on public.anime_collections for select using (user_id = auth.uid() or (is_public and public.can_view(user_id, 'lists')));
create policy collections_write on public.anime_collections for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy collection_items_read on public.collection_items for select
  using (exists (select 1 from public.anime_collections c where c.id = collection_id and (c.user_id = auth.uid() or (c.is_public and public.can_view(c.user_id, 'lists')))));
create policy collection_items_write on public.collection_items for all
  using (exists (select 1 from public.anime_collections c where c.id = collection_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.anime_collections c where c.id = collection_id and c.user_id = auth.uid()));

create policy assets_read on public.media_assets for select using (true);
create policy entitlements_read on public.media_entitlements for select using (user_id is null or user_id = auth.uid());

create policy progress_read on public.watch_progress for select using (user_id = auth.uid() or public.can_view(user_id, 'history'));
create policy progress_write on public.watch_progress for insert with check (user_id = auth.uid());
create policy progress_update on public.watch_progress for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy progress_delete on public.watch_progress for delete using (user_id = auth.uid());

create policy sessions_owner on public.playback_sessions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy reviews_read on public.reviews for select
  using ((status = 'published' and not public.is_blocked_between(auth.uid(), user_id)) or user_id = auth.uid() or public.is_moderator());
create policy reviews_insert on public.reviews for insert with check (user_id = auth.uid() and status = 'published' and like_count = 0 and comment_count = 0);
create policy reviews_update on public.reviews for update using (user_id = auth.uid() or public.is_moderator()) with check (user_id = auth.uid() or public.is_moderator());
create policy reviews_delete on public.reviews for delete using (user_id = auth.uid());

create policy reactions_read on public.review_reactions for select using (true);
create policy reactions_write on public.review_reactions for insert with check (user_id = auth.uid());
create policy reactions_delete on public.review_reactions for delete using (user_id = auth.uid());

create policy discussions_read on public.discussions for select
  using ((status in ('published', 'locked') and not public.is_blocked_between(auth.uid(), user_id)) or user_id = auth.uid() or public.is_moderator());
create policy discussions_insert on public.discussions for insert with check (user_id = auth.uid() and status = 'published' and comment_count = 0);
create policy discussions_update on public.discussions for update using (user_id = auth.uid() or public.is_moderator()) with check (user_id = auth.uid() or public.is_moderator());
create policy discussions_delete on public.discussions for delete using (user_id = auth.uid());

create policy comments_read on public.comments for select
  using ((status = 'published' and not public.is_blocked_between(auth.uid(), user_id)) or user_id = auth.uid() or public.is_moderator());
create policy comments_insert on public.comments for insert with check (user_id = auth.uid() and status = 'published');
create policy comments_update on public.comments for update using (user_id = auth.uid() or public.is_moderator()) with check (user_id = auth.uid() or public.is_moderator());
create policy comments_delete on public.comments for delete using (user_id = auth.uid());

create policy reports_insert on public.reports for insert with check (reporter_id = auth.uid() and status = 'open');
create policy reports_read on public.reports for select using (reporter_id = auth.uid() or public.is_moderator());
create policy reports_moderate on public.reports for update using (public.is_moderator()) with check (public.is_moderator());

create policy moderators_self on public.moderators for select using (user_id = auth.uid());

create policy activity_read on public.activity_events for select using (public.can_view(user_id, 'activity'));
create policy activity_delete on public.activity_events for delete using (user_id = auth.uid());

create policy notifications_owner_read on public.notifications for select using (user_id = auth.uid());
create policy notifications_owner_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_owner_delete on public.notifications for delete using (user_id = auth.uid());

-- host_id is checked on the row itself: lookups can't see a row during INSERT ... RETURNING.
create policy rooms_read on public.watch_party_rooms for select using (host_id = auth.uid() or public.can_join_room(id) or public.is_room_member(id));
create policy rooms_insert on public.watch_party_rooms for insert with check (host_id = auth.uid() and state_version = 0);
create policy rooms_end on public.watch_party_rooms for update using (host_id = auth.uid()) with check (host_id = auth.uid());

create policy participants_read on public.watch_party_participants for select using (public.is_room_member(room_id));
create policy participants_join on public.watch_party_participants for insert
  with check (user_id = auth.uid() and role = 'guest' and public.can_join_room(room_id));
create policy participants_update on public.watch_party_participants for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and role = (select case when r.host_id = auth.uid() then 'host' else 'guest' end from public.watch_party_rooms r where r.id = room_id));

create policy invites_read on public.watch_party_invites for select using (user_id = auth.uid() or invited_by = auth.uid());
create policy invites_insert on public.watch_party_invites for insert
  with check (
    invited_by = auth.uid()
    and exists (select 1 from public.watch_party_rooms r where r.id = room_id and r.host_id = auth.uid() and r.ended_at is null)
    and public.are_friends(auth.uid(), user_id)
  );

create policy messages_read on public.watch_party_messages for select using (public.is_room_member(room_id));
create policy messages_insert on public.watch_party_messages for insert with check (user_id = auth.uid() and public.is_room_member(room_id));

create policy achievements_read on public.achievements for select using (true);
create policy user_achievements_read on public.user_achievements for select using (public.can_view(user_id, 'profile'));
create policy user_achievements_insert on public.user_achievements for insert
  with check (user_id = auth.uid() and exists (select 1 from public.achievements a where a.id = achievement_id));

create policy rec_prefs_owner on public.recommendation_preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy goals_owner on public.seasonal_goals for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Function privileges: callable by signed-in users only.
revoke execute on function public.send_friend_request(uuid) from public, anon;
revoke execute on function public.respond_friend_request(uuid, boolean) from public, anon;
revoke execute on function public.remove_friend(uuid) from public, anon;
revoke execute on function public.block_user(uuid) from public, anon;
revoke execute on function public.watch_party_control(uuid, boolean, double precision, text, real) from public, anon;
revoke execute on function public.delete_my_data() from public, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.watch_party_control(uuid, boolean, double precision, text, real) to authenticated;
grant execute on function public.delete_my_data() to authenticated;
grant execute on function public.server_time() to anon, authenticated;

-- ── Realtime ─────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.watch_party_rooms;
alter publication supabase_realtime add table public.watch_party_messages;
alter publication supabase_realtime add table public.watch_party_participants;

-- ── Storage: avatars & banners (validated type and size) ────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media', 'profile-media', true, 3145728, array['image/png', 'image/jpeg', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

create policy "profile media read" on storage.objects for select using (bucket_id = 'profile-media');
create policy "profile media write own folder" on storage.objects for insert
  with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "profile media update own" on storage.objects for update
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "profile media delete own" on storage.objects for delete
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);
