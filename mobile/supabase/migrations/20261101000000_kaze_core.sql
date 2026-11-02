-- =====================================================================
-- KAZE shared backend — core schema (profiles, social, library, community,
-- notifications, watch parties). Designed to be shared by KAZE Web and
-- KAZE Mobile. Every table has Row Level Security; clients only ever use
-- the anon key + the signed-in user's JWT. No service-role key ships in apps.
--
-- If KAZE Web already defines any of these tables, compare column-by-column
-- (see docs/BACKEND.md "Compatibility checklist") before applying.
-- =====================================================================

create extension if not exists citext;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        citext unique not null check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  display_name    text not null default '' check (char_length(display_name) <= 40),
  bio             text not null default '' check (char_length(bio) <= 300),
  avatar_url      text check (avatar_url is null or avatar_url like 'https://%'),
  banner_url      text check (banner_url is null or banner_url like 'https://%'),
  profile_theme   text check (profile_theme in ('MIDNIGHT_NEON','SAKURA_DREAM','CYBER_PULSE','ZEN_STUDIO')),
  favorite_genres text[] not null default '{}',
  is_private      boolean not null default false,  -- hides library/activity from non-friends
  show_activity   boolean not null default true,   -- friends can see activity feed
  show_online     boolean not null default false,  -- optional presence
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Auto-create a profile from sign-up metadata (username chosen in the app).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  wanted text := coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8));
begin
  if wanted !~ '^[A-Za-z0-9_]{3,24}$' or exists (select 1 from public.profiles where username = wanted) then
    wanted := 'user_' || substr(replace(new.id::text, '-', ''), 1, 10);
  end if;
  insert into public.profiles (id, username, display_name) values (new.id, wanted, wanted);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- relationships
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.friendships (
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create table if not exists public.friend_requests (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles(id) on delete cascade,
  receiver_id  uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','accepted','rejected','cancelled')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  check (sender_id <> receiver_id)
);
create unique index if not exists friend_requests_one_pending
  on public.friend_requests (least(sender_id, receiver_id), greatest(sender_id, receiver_id)) where status = 'pending';

create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from friendships where user_a = least(a, b) and user_b = greatest(a, b));
$$;

-- ---------------------------------------------------------------- library (cloud copy of the device library)
create table if not exists public.library_entries (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  anime_id    integer not null,               -- AniList media id
  status      text not null check (status in ('WATCHING','COMPLETED','PLANNING','PAUSED','DROPPED','REWATCHING')),
  progress    integer not null default 0 check (progress >= 0),
  score       integer check (score between 0 and 100),
  is_favorite boolean not null default false,
  title       text not null default '',
  cover_url   text,
  updated_at  timestamptz not null default now(),
  primary key (user_id, anime_id)
);

-- ---------------------------------------------------------------- activity feed
create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text not null check (type in ('added','completed','progress','rated','review_posted','party_hosted','favorited')),
  anime_id    integer,
  anime_title text,
  anime_cover text,
  detail      text check (char_length(detail) <= 200),
  created_at  timestamptz not null default now()
);
create index if not exists activities_user_time on public.activities (user_id, created_at desc);

-- ---------------------------------------------------------------- community
create table if not exists public.reviews (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  anime_id     integer not null,
  anime_title  text not null,
  anime_cover  text,
  score        integer not null check (score between 1 and 100),
  body         text not null check (char_length(body) between 20 and 8000),
  has_spoilers boolean not null default false,
  like_count   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, anime_id)
);

create table if not exists public.discussions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  anime_id         integer,
  anime_title      text,
  title            text not null check (char_length(title) between 4 and 140),
  body             text not null check (char_length(body) between 1 and 8000),
  has_spoilers     boolean not null default false,
  comment_count    integer not null default 0,
  like_count       integer not null default 0,
  created_at       timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create table if not exists public.comments (
  id            uuid primary key default gen_random_uuid(),
  discussion_id uuid references public.discussions(id) on delete cascade,
  review_id     uuid references public.reviews(id) on delete cascade,
  parent_id     uuid references public.comments(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  body          text not null check (char_length(body) between 1 and 4000),
  has_spoilers  boolean not null default false,
  like_count    integer not null default 0,
  is_deleted    boolean not null default false,
  created_at    timestamptz not null default now(),
  check ((discussion_id is not null) <> (review_id is not null))
);

create table if not exists public.likes (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('review','discussion','comment')),
  target_id   uuid not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('review','discussion','comment','profile','party_message')),
  target_id   text not null,
  reason      text not null check (char_length(reason) between 3 and 500),
  status      text not null default 'open' check (status in ('open','actioned','dismissed')),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- notifications
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  actor_id   uuid references public.profiles(id) on delete cascade,
  type       text not null check (type in ('friend_request','friend_accepted','reply','reaction','party_invite','system')),
  entity_id  text,
  title      text not null,
  body       text not null default '',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_time on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------- watch parties
create table if not exists public.watch_parties (
  id               uuid primary key default gen_random_uuid(),
  code             text unique not null default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  host_id          uuid not null references public.profiles(id) on delete cascade,
  anime_id         integer not null,
  anime_title      text not null,
  anime_cover      text,
  episode          integer not null default 1,
  media_provider   text not null default 'kaze-demo', -- each member resolves media independently
  is_playing       boolean not null default false,
  position_ms      bigint not null default 0,
  playback_rate    real not null default 1,
  state_updated_at timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default now() + interval '6 hours',
  ended_at         timestamptz
);

create table if not exists public.party_members (
  party_id     uuid not null references public.watch_parties(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (party_id, user_id)
);

create table if not exists public.party_messages (
  id         uuid primary key default gen_random_uuid(),
  party_id   uuid not null references public.watch_parties(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null default 'chat' check (kind in ('chat','reaction','system')),
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.party_invites (
  id         uuid primary key default gen_random_uuid(),
  party_id   uuid not null references public.watch_parties(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (party_id, invitee_id)
);

create or replace function public.is_party_member(p uuid, u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from party_members where party_id = p and user_id = u);
$$;

-- updated_at maintained by the database, never trusted from clients.
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists reviews_touch on public.reviews;
create trigger reviews_touch before update on public.reviews for each row execute function public.touch_updated_at();
drop trigger if exists library_touch on public.library_entries;
create trigger library_touch before insert or update on public.library_entries for each row execute function public.touch_updated_at();

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles        enable row level security;
alter table public.blocks          enable row level security;
alter table public.friendships     enable row level security;
alter table public.friend_requests enable row level security;
alter table public.library_entries enable row level security;
alter table public.activities      enable row level security;
alter table public.reviews         enable row level security;
alter table public.discussions     enable row level security;
alter table public.comments        enable row level security;
alter table public.likes           enable row level security;
alter table public.reports         enable row level security;
alter table public.notifications   enable row level security;
alter table public.watch_parties   enable row level security;
alter table public.party_members   enable row level security;
alter table public.party_messages  enable row level security;
alter table public.party_invites   enable row level security;

-- Profiles: public basics are readable by signed-in users who aren't blocked; only the owner writes.
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or not public.is_blocked_between(id, auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy blocks_own on public.blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

create policy friendships_read on public.friendships for select to authenticated
  using (auth.uid() in (user_a, user_b));
create policy friendships_delete on public.friendships for delete to authenticated
  using (auth.uid() in (user_a, user_b));

create policy friend_requests_read on public.friend_requests for select to authenticated
  using (auth.uid() in (sender_id, receiver_id));
-- Inserts/updates go through RPCs (send/respond/cancel) which enforce blocks and duplicates.

create policy library_owner on public.library_entries for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy library_visible on public.library_entries for select to authenticated
  using (exists (select 1 from profiles p where p.id = user_id and
         (not p.is_private or public.are_friends(p.id, auth.uid())) and not public.is_blocked_between(p.id, auth.uid())));

create policy activities_owner on public.activities for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy activities_friends on public.activities for select to authenticated
  using (exists (select 1 from profiles p where p.id = user_id and p.show_activity and public.are_friends(p.id, auth.uid())));

create policy reviews_read on public.reviews for select to authenticated using (not public.is_blocked_between(user_id, auth.uid()));
create policy reviews_write on public.reviews for insert to authenticated with check (user_id = auth.uid());
create policy reviews_update on public.reviews for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reviews_delete on public.reviews for delete to authenticated using (user_id = auth.uid());

create policy discussions_read on public.discussions for select to authenticated using (not public.is_blocked_between(user_id, auth.uid()));
create policy discussions_write on public.discussions for insert to authenticated with check (user_id = auth.uid());
create policy discussions_update on public.discussions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy discussions_delete on public.discussions for delete to authenticated using (user_id = auth.uid());

create policy comments_read on public.comments for select to authenticated using (not public.is_blocked_between(user_id, auth.uid()));
create policy comments_write on public.comments for insert to authenticated with check (user_id = auth.uid());
create policy comments_update on public.comments for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy likes_read on public.likes for select to authenticated using (true);
create policy likes_own on public.likes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy reports_insert on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy reports_read_own on public.reports for select to authenticated using (reporter_id = auth.uid());

create policy notifications_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_mark on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

create policy parties_read on public.watch_parties for select to authenticated
  using (host_id = auth.uid() or public.is_party_member(id, auth.uid())
         or exists (select 1 from party_invites i where i.party_id = watch_parties.id and i.invitee_id = auth.uid()));
create policy members_read on public.party_members for select to authenticated using (public.is_party_member(party_id, auth.uid()));
create policy members_leave on public.party_members for delete to authenticated using (user_id = auth.uid());
create policy messages_read on public.party_messages for select to authenticated using (public.is_party_member(party_id, auth.uid()));
create policy messages_write on public.party_messages for insert to authenticated
  with check (user_id = auth.uid() and kind <> 'system' and public.is_party_member(party_id, auth.uid()));
create policy invites_read on public.party_invites for select to authenticated using (auth.uid() in (inviter_id, invitee_id));

-- =====================================================================
-- RPCs (security definer; each validates auth.uid())
-- =====================================================================
create or replace function public.server_now() returns timestamptz language sql stable as $$ select now(); $$;

create or replace function public.notify(target uuid, actor uuid, kind text, entity text, t text, b text) returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, actor_id, type, entity_id, title, body)
  select target, actor, kind, entity, t, b where target <> actor and not is_blocked_between(target, actor);
$$;
revoke execute on function public.notify(uuid, uuid, text, text, text, text) from public, anon, authenticated;

create or replace function public.send_friend_request(target uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); rid uuid; my_name text;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if target = me then raise exception 'cannot befriend yourself'; end if;
  if is_blocked_between(me, target) then raise exception 'cannot send request'; end if;
  if are_friends(me, target) then raise exception 'already friends'; end if;
  -- If they already asked us, accept instead of creating a duplicate.
  select id into rid from friend_requests where sender_id = target and receiver_id = me and status = 'pending';
  if rid is not null then perform respond_friend_request(rid, true); return rid; end if;
  insert into friend_requests (sender_id, receiver_id) values (me, target) returning id into rid;
  select coalesce(nullif(display_name, ''), username) into my_name from profiles where id = me;
  perform notify(target, me, 'friend_request', rid::text, my_name || ' sent you a friend request', '');
  return rid;
end $$;

create or replace function public.respond_friend_request(request_id uuid, accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r friend_requests; me uuid := auth.uid(); my_name text;
begin
  select * into r from friend_requests where id = request_id and status = 'pending' for update;
  if r.id is null or r.receiver_id <> me then raise exception 'request not found'; end if;
  update friend_requests set status = case when accept then 'accepted' else 'rejected' end, responded_at = now() where id = r.id;
  if accept then
    insert into friendships (user_a, user_b) values (least(r.sender_id, r.receiver_id), greatest(r.sender_id, r.receiver_id)) on conflict do nothing;
    select coalesce(nullif(display_name, ''), username) into my_name from profiles where id = me;
    perform notify(r.sender_id, me, 'friend_accepted', me::text, my_name || ' accepted your friend request', '');
  end if;
end $$;

create or replace function public.cancel_friend_request(request_id uuid) returns void
language sql security definer set search_path = public as $$
  update friend_requests set status = 'cancelled', responded_at = now()
  where id = request_id and sender_id = auth.uid() and status = 'pending';
$$;

create or replace function public.remove_friend(other uuid) returns void
language sql security definer set search_path = public as $$
  delete from friendships where user_a = least(auth.uid(), other) and user_b = greatest(auth.uid(), other);
$$;

create or replace function public.block_user(target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or target = auth.uid() then raise exception 'invalid'; end if;
  insert into blocks (blocker_id, blocked_id) values (auth.uid(), target) on conflict do nothing;
  delete from friendships where user_a = least(auth.uid(), target) and user_b = greatest(auth.uid(), target);
  update friend_requests set status = 'cancelled', responded_at = now()
    where status = 'pending' and ((sender_id = auth.uid() and receiver_id = target) or (sender_id = target and receiver_id = auth.uid()));
end $$;

create or replace function public.unblock_user(target uuid) returns void
language sql security definer set search_path = public as $$
  delete from blocks where blocker_id = auth.uid() and blocked_id = target;
$$;

create or replace function public.mutual_friends(other uuid) returns setof public.profiles
language sql stable security definer set search_path = public as $$
  select p.* from profiles p
  where are_friends(p.id, auth.uid()) and are_friends(p.id, other) and p.id not in (auth.uid(), other);
$$;

create or replace function public.toggle_like(t_type text, t_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); liked boolean; owner uuid; my_name text;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from likes where user_id = me and target_type = t_type and target_id = t_id) then
    delete from likes where user_id = me and target_type = t_type and target_id = t_id; liked := false;
  else
    insert into likes (user_id, target_type, target_id) values (me, t_type, t_id); liked := true;
  end if;
  if t_type = 'review' then
    update reviews set like_count = like_count + case when liked then 1 else -1 end where id = t_id returning user_id into owner;
  elsif t_type = 'discussion' then
    update discussions set like_count = like_count + case when liked then 1 else -1 end where id = t_id returning user_id into owner;
  else
    update comments set like_count = like_count + case when liked then 1 else -1 end where id = t_id returning user_id into owner;
  end if;
  if liked and owner is not null then
    select coalesce(nullif(display_name, ''), username) into my_name from profiles where id = me;
    perform notify(owner, me, 'reaction', t_id::text, my_name || ' liked your ' || t_type, '');
  end if;
  return liked;
end $$;

-- Replies notify the parent author (or the discussion author for top-level comments).
create or replace function public.on_comment_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare target uuid; my_name text;
begin
  if new.parent_id is not null then select user_id into target from comments where id = new.parent_id;
  elsif new.discussion_id is not null then select user_id into target from discussions where id = new.discussion_id;
  else select user_id into target from reviews where id = new.review_id; end if;
  if new.discussion_id is not null then
    update discussions set comment_count = comment_count + 1, last_activity_at = now() where id = new.discussion_id;
  end if;
  select coalesce(nullif(display_name, ''), username) into my_name from profiles where id = new.user_id;
  perform notify(target, new.user_id, 'reply', coalesce(new.discussion_id, new.review_id)::text, my_name || ' replied to you', left(new.body, 140));
  return new;
end $$;
drop trigger if exists comments_after_insert on public.comments;
create trigger comments_after_insert after insert on public.comments for each row execute function public.on_comment_insert();

-- Watch parties ------------------------------------------------------
create or replace function public.create_party(p_anime_id integer, p_title text, p_cover text, p_episode integer) returns public.watch_parties
language plpgsql security definer set search_path = public as $$
declare p watch_parties;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into watch_parties (host_id, anime_id, anime_title, anime_cover, episode)
    values (auth.uid(), p_anime_id, left(p_title, 200), p_cover, greatest(p_episode, 1)) returning * into p;
  insert into party_members (party_id, user_id) values (p.id, auth.uid());
  insert into activities (user_id, type, anime_id, anime_title, anime_cover) values (auth.uid(), 'party_hosted', p_anime_id, p_title, p_cover);
  return p;
end $$;

create or replace function public.join_party(p_code text) returns public.watch_parties
language plpgsql security definer set search_path = public as $$
declare p watch_parties;
begin
  select * into p from watch_parties where code = upper(p_code) and ended_at is null and expires_at > now();
  if p.id is null then raise exception 'party not found or expired'; end if;
  if is_blocked_between(p.host_id, auth.uid()) then raise exception 'party not found or expired'; end if;
  insert into party_members (party_id, user_id) values (p.id, auth.uid())
    on conflict (party_id, user_id) do update set last_seen_at = now();
  return p;
end $$;

-- Server-authoritative playback state: only the host may change it; time is stamped by the server.
create or replace function public.party_update_state(p_party uuid, p_playing boolean, p_position bigint, p_rate real, p_episode integer)
returns public.watch_parties language plpgsql security definer set search_path = public as $$
declare p watch_parties;
begin
  update watch_parties set is_playing = p_playing, position_ms = greatest(p_position, 0),
         playback_rate = least(greatest(p_rate, 0.25), 3), episode = greatest(p_episode, 1), state_updated_at = now()
   where id = p_party and host_id = auth.uid() and ended_at is null
   returning * into p;
  if p.id is null then raise exception 'only the host can control playback'; end if;
  return p;
end $$;

create or replace function public.party_heartbeat(p_party uuid) returns void
language sql security definer set search_path = public as $$
  update party_members set last_seen_at = now() where party_id = p_party and user_id = auth.uid();
$$;

-- Host departure: hand the remote to the longest-present active member, or end the room.
create or replace function public.leave_party(p_party uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p watch_parties; heir uuid;
begin
  select * into p from watch_parties where id = p_party for update;
  delete from party_members where party_id = p_party and user_id = auth.uid();
  if p.host_id = auth.uid() then
    select user_id into heir from party_members
      where party_id = p_party and last_seen_at > now() - interval '2 minutes'
      order by joined_at limit 1;
    if heir is null then update watch_parties set ended_at = now(), is_playing = false where id = p_party;
    else update watch_parties set host_id = heir, state_updated_at = now() where id = p_party; end if;
  end if;
end $$;

create or replace function public.invite_to_party(p_party uuid, p_friend uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p watch_parties; my_name text;
begin
  select * into p from watch_parties where id = p_party;
  if p.id is null or not is_party_member(p_party, auth.uid()) then raise exception 'not a member'; end if;
  if not are_friends(auth.uid(), p_friend) then raise exception 'you can only invite friends'; end if;
  insert into party_invites (party_id, inviter_id, invitee_id) values (p_party, auth.uid(), p_friend) on conflict do nothing;
  select coalesce(nullif(display_name, ''), username) into my_name from profiles where id = auth.uid();
  perform notify(p_friend, auth.uid(), 'party_invite', p.code, my_name || ' invited you to watch ' || p.anime_title, 'Room code ' || p.code);
end $$;

-- Account deletion (cascades to every table above via auth.users).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Realtime publication for live rooms, chat and notifications (RLS still applies).
alter publication supabase_realtime add table public.watch_parties, public.party_messages, public.notifications, public.friend_requests;
