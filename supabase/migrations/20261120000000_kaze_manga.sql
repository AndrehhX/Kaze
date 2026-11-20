-- ════════════════════════════════════════════════════════════════════
-- KAZE MANGA — additive schema
-- Nothing here alters or drops existing tables/data. Reuses: profiles,
-- user_settings (new nullable column), library_notes (notes are keyed by
-- AniList media id, which is unique across anime and manga), reviews,
-- discussions, activity_events, can_view(), is_moderator().
-- Manga ids are AniList ids (> 0) or KAZE Originals demo ids (< 0).
-- ════════════════════════════════════════════════════════════════════

-- ── Reader preferences ride on the existing settings row ────────────
alter table public.user_settings add column if not exists reader jsonb not null default '{}'::jsonb;

-- ── Library ──────────────────────────────────────────────────────────
create table public.manga_library_entries (
  user_id uuid not null references public.profiles (id) on delete cascade,
  manga_id integer not null check (manga_id <> 0),
  status text not null check (status in ('CURRENT', 'PLANNING', 'COMPLETED', 'DROPPED', 'PAUSED', 'REPEATING')),
  progress integer not null default 0 check (progress >= 0 and progress <= 10000),
  progress_volumes integer not null default 0 check (progress_volumes >= 0 and progress_volumes <= 1000),
  last_chapter_id text check (last_chapter_id is null or char_length(last_chapter_id) <= 120),
  last_chapter_label text check (last_chapter_label is null or char_length(last_chapter_label) <= 120),
  last_page integer check (last_page is null or last_page >= 0),
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
  primary key (user_id, manga_id)
);
create index manga_library_user_status on public.manga_library_entries (user_id, status, updated_at desc);

create table public.manga_reading_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  manga_id integer not null check (manga_id <> 0),
  chapter_id text not null check (char_length(chapter_id) between 1 and 120),
  page integer not null default 0 check (page >= 0),
  page_count integer not null default 0 check (page_count >= 0),
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, manga_id, chapter_id)
);
create index manga_progress_recent on public.manga_reading_progress (user_id, updated_at desc);

create table public.manga_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  manga_id integer not null check (manga_id <> 0),
  chapter_id text not null check (char_length(chapter_id) between 1 and 120),
  chapter_label text not null default '' check (char_length(chapter_label) <= 120),
  page integer not null default 0 check (page >= 0),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index manga_bookmarks_user on public.manga_bookmarks (user_id, manga_id);

-- Measured reading sessions (active time only). Powers honest reading statistics.
create table public.manga_reading_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  manga_id integer not null check (manga_id <> 0),
  chapter_id text not null check (char_length(chapter_id) between 1 and 120),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  active_seconds integer not null check (active_seconds between 0 and 86400),
  pages_viewed integer not null default 0 check (pages_viewed between 0 and 10000),
  check (ended_at >= started_at)
);
create index manga_sessions_user on public.manga_reading_sessions (user_id, started_at desc);

-- Separate from anime_collections so the existing anime collection loader keeps working unchanged.
create table public.manga_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 400),
  color text not null default '#e96b35' check (color ~ '^#[0-9a-fA-F]{6}$'),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index manga_collections_user on public.manga_collections (user_id, updated_at desc);

create table public.manga_collection_items (
  collection_id uuid not null references public.manga_collections (id) on delete cascade,
  manga_id integer not null check (manga_id <> 0),
  position integer not null default 0,
  media_snapshot jsonb not null default '{}'::jsonb,
  added_at timestamptz not null default now(),
  primary key (collection_id, manga_id)
);

-- ── Catalog & availability (written by the service role / licensed providers only) ──
create table public.manga_chapter_catalog (
  provider text not null,
  chapter_id text not null,
  series_key text not null,
  edition_id text not null,
  language text not null check (char_length(language) between 2 and 12),
  number text,
  sort_key numeric not null,
  kind text not null default 'regular' check (kind in ('regular', 'special', 'bonus', 'extra', 'oneshot', 'prologue')),
  title text,
  volume text,
  page_count integer not null default 0 check (page_count >= 0),
  released_at date,
  created_at timestamptz not null default now(),
  primary key (provider, chapter_id)
);
create index manga_catalog_series on public.manga_chapter_catalog (series_key, language, sort_key);

create table public.manga_content_availability (
  id uuid primary key default gen_random_uuid(),
  series_key text not null,
  provider text not null,
  kind text not null check (kind in ('embedded', 'external')),
  url text check (url is null or url ~ '^(https://|/)'),
  language text,
  license text not null check (license in ('original', 'public-domain', 'licensed', 'official-link')),
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (series_key, provider, kind, language)
);

-- ── Anime → manga adaptation mappings ────────────────────────────────
create table public.anime_manga_adaptation_mappings (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  franchise text not null check (franchise ~ '^[a-z0-9-]+$'),
  sort_order integer not null default 0,
  anime_id integer not null check (anime_id > 0),
  anime_season_identifier text not null check (char_length(anime_season_identifier) between 1 and 40),
  anime_label text not null,
  anime_format text not null check (anime_format in ('TV', 'MOVIE', 'OVA', 'ONA', 'SPECIAL')),
  anime_episode_from integer check (anime_episode_from is null or anime_episode_from >= 0),
  anime_episode_to integer check (anime_episode_to is null or anime_episode_to >= 0),
  manga_id integer not null check (manga_id > 0),
  manga_chapter_start text check (manga_chapter_start is null or manga_chapter_start ~ '^\d+(\.\d+)?$'),
  manga_chapter_end text check (manga_chapter_end is null or manga_chapter_end ~ '^\d+(\.\d+)?$'),
  manga_volume text,
  continuation_chapter text check (continuation_chapter is null or continuation_chapter ~ '^\d+(\.\d+)?$'),
  recommended_start_chapter text check (recommended_start_chapter is null or recommended_start_chapter ~ '^\d+(\.\d+)?$'),
  alternative_starts jsonb not null default '[]'::jsonb,
  relation text not null check (relation in ('faithful', 'reordered', 'partial', 'anime-original', 'side-story', 'compilation')),
  adaptation_notes text not null default '' check (char_length(adaptation_notes) <= 600),
  skipped_material_warning text check (skipped_material_warning is null or char_length(skipped_material_warning) <= 300),
  verification_status text not null check (verification_status in ('verified', 'pending', 'approximate', 'unknown')),
  basis text,
  verified_at timestamptz,
  verified_by uuid references public.profiles (id) on delete set null,
  revision integer not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (anime_id, anime_season_identifier, manga_id),
  check (anime_episode_to is null or anime_episode_from is null or anime_episode_to >= anime_episode_from),
  -- Never certain without evidence: verified rows need a date and a chapter; approximate rows need a basis.
  check (verification_status <> 'verified' or (verified_at is not null and continuation_chapter is not null)),
  check (verification_status <> 'approximate' or basis is not null),
  check (verification_status <> 'unknown' or (continuation_chapter is null and recommended_start_chapter is null))
);
create index adaptation_by_anime on public.anime_manga_adaptation_mappings (anime_id);
create index adaptation_by_franchise on public.anime_manga_adaptation_mappings (franchise, sort_order);

create table public.adaptation_mapping_sources (
  id uuid primary key default gen_random_uuid(),
  mapping_id text not null references public.anime_manga_adaptation_mappings (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 300),
  url text not null check (url ~ '^https://'),
  publisher text not null,
  accessed_at date not null,
  unique (mapping_id, url)
);

-- Full history: every insert/update of a mapping is snapshotted by trigger.
create table public.adaptation_mapping_revisions (
  id uuid primary key default gen_random_uuid(),
  mapping_id text not null,
  revision integer not null,
  snapshot jsonb not null,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  unique (mapping_id, revision)
);

-- Community submissions are kept apart from reviewed data and never shown as verified.
create table public.adaptation_mapping_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  anime_id integer not null check (anime_id > 0),
  anime_season_identifier text not null check (char_length(anime_season_identifier) between 1 and 40),
  manga_id integer not null check (manga_id > 0),
  manga_chapter_end text check (manga_chapter_end is null or manga_chapter_end ~ '^\d+(\.\d+)?$'),
  continuation_chapter text not null check (continuation_chapter ~ '^\d+(\.\d+)?$'),
  notes text not null default '' check (char_length(notes) <= 600),
  source_urls text[] not null check (cardinality(source_urls) between 1 and 5),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  reviewer_id uuid references public.profiles (id) on delete set null,
  reviewer_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index adaptation_submissions_anime on public.adaptation_mapping_submissions (anime_id, status);
create unique index adaptation_submissions_one_pending on public.adaptation_mapping_submissions (user_id, anime_id, anime_season_identifier) where status = 'pending';

-- ════════════════════════════════════════════════════════════════════
-- Triggers
-- ════════════════════════════════════════════════════════════════════
create trigger manga_collections_touch before update on public.manga_collections for each row execute function public.touch_updated_at();

create or replace function public.on_adaptation_mapping_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.revision := old.revision + 1;
    new.updated_at := now();
  end if;
  insert into adaptation_mapping_revisions (mapping_id, revision, snapshot, changed_by)
  values (new.id, new.revision, to_jsonb(new), auth.uid());
  return new;
end;
$$;
create trigger adaptation_mapping_insert after insert on public.anime_manga_adaptation_mappings
for each row execute function public.on_adaptation_mapping_change();
create trigger adaptation_mapping_update before update on public.anime_manga_adaptation_mappings
for each row execute function public.on_adaptation_mapping_change();

-- Reading activity feeds the existing friends feed (same event kinds, manga snapshot marks the type).
create or replace function public.on_manga_library_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare snap jsonb := new.media_snapshot || jsonb_build_object('kind', 'manga');
begin
  if new.manga_id < 0 then return new; end if; -- demo series stay private to the device feed
  if tg_op = 'INSERT' and new.status in ('CURRENT', 'REPEATING') then
    insert into activity_events (user_id, kind, media_id, media_snapshot) values (new.user_id, 'started', new.manga_id, snap);
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status = 'COMPLETED' then
    insert into activity_events (user_id, kind, media_id, media_snapshot, payload) values (new.user_id, 'completed', new.manga_id, snap, jsonb_build_object('score', new.score));
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('CURRENT', 'REPEATING') and old.status not in ('CURRENT', 'REPEATING') then
    insert into activity_events (user_id, kind, media_id, media_snapshot) values (new.user_id, 'started', new.manga_id, snap);
  end if;
  if tg_op = 'UPDATE' and new.score is distinct from old.score and new.score is not null then
    insert into activity_events (user_id, kind, media_id, media_snapshot, payload) values (new.user_id, 'rated', new.manga_id, snap, jsonb_build_object('score', new.score));
  end if;
  if (tg_op = 'INSERT' and new.favorite) or (tg_op = 'UPDATE' and new.favorite and not old.favorite) then
    insert into activity_events (user_id, kind, media_id, media_snapshot) values (new.user_id, 'favorited', new.manga_id, snap);
  end if;
  return new;
end;
$$;
create trigger manga_library_activity after insert or update on public.manga_library_entries
for each row execute function public.on_manga_library_change();

-- Moderators review community submissions. Accepting never auto-promotes to "verified".
create or replace function public.review_adaptation_submission(submission uuid, accept boolean, note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_moderator() then raise exception 'not allowed'; end if;
  update adaptation_mapping_submissions
     set status = case when accept then 'accepted' else 'rejected' end,
         reviewer_id = auth.uid(), reviewer_note = note, reviewed_at = now()
   where id = submission and status = 'pending';
  if not found then raise exception 'submission not found'; end if;
end;
$$;

-- ════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ════════════════════════════════════════════════════════════════════
alter table public.manga_library_entries enable row level security;
alter table public.manga_reading_progress enable row level security;
alter table public.manga_bookmarks enable row level security;
alter table public.manga_reading_sessions enable row level security;
alter table public.manga_collections enable row level security;
alter table public.manga_collection_items enable row level security;
alter table public.manga_chapter_catalog enable row level security;
alter table public.manga_content_availability enable row level security;
alter table public.anime_manga_adaptation_mappings enable row level security;
alter table public.adaptation_mapping_sources enable row level security;
alter table public.adaptation_mapping_revisions enable row level security;
alter table public.adaptation_mapping_submissions enable row level security;

-- Lists follow the owner's "lists" privacy facet, exactly like anime lists.
create policy manga_library_read on public.manga_library_entries for select using (public.can_view(user_id, 'lists'));
create policy manga_library_insert on public.manga_library_entries for insert with check (user_id = auth.uid());
create policy manga_library_update on public.manga_library_entries for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy manga_library_delete on public.manga_library_entries for delete using (user_id = auth.uid());

-- Page-level progress is reading history: owner only, or the "history" facet.
create policy manga_progress_read on public.manga_reading_progress for select using (user_id = auth.uid() or public.can_view(user_id, 'history'));
create policy manga_progress_write on public.manga_reading_progress for insert with check (user_id = auth.uid());
create policy manga_progress_update on public.manga_reading_progress for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy manga_progress_delete on public.manga_reading_progress for delete using (user_id = auth.uid());

-- Bookmarks and measured sessions are private.
create policy manga_bookmarks_owner on public.manga_bookmarks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy manga_sessions_owner on public.manga_reading_sessions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy manga_collections_read on public.manga_collections for select using (user_id = auth.uid() or (is_public and public.can_view(user_id, 'lists')));
create policy manga_collections_write on public.manga_collections for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy manga_collection_items_read on public.manga_collection_items for select
  using (exists (select 1 from manga_collections c where c.id = collection_id and (c.user_id = auth.uid() or (c.is_public and public.can_view(c.user_id, 'lists')))));
create policy manga_collection_items_write on public.manga_collection_items for all
  using (exists (select 1 from manga_collections c where c.id = collection_id and c.user_id = auth.uid()))
  with check (exists (select 1 from manga_collections c where c.id = collection_id and c.user_id = auth.uid()));

-- Catalog/availability: public read, no client writes (service role bypasses RLS).
create policy manga_catalog_read on public.manga_chapter_catalog for select using (true);
create policy manga_availability_read on public.manga_content_availability for select using (true);

-- Mappings: everyone reads reviewed data; only moderators edit it.
create policy adaptation_read on public.anime_manga_adaptation_mappings for select using (verification_status <> 'pending' or public.is_moderator());
create policy adaptation_moderate on public.anime_manga_adaptation_mappings for all using (public.is_moderator()) with check (public.is_moderator());
create policy adaptation_sources_read on public.adaptation_mapping_sources for select using (true);
create policy adaptation_sources_moderate on public.adaptation_mapping_sources for all using (public.is_moderator()) with check (public.is_moderator());
create policy adaptation_revisions_read on public.adaptation_mapping_revisions for select using (public.is_moderator());

-- Submissions: authors see their own, moderators see all; inserts are always 'pending' and unreviewed.
create policy adaptation_submissions_read on public.adaptation_mapping_submissions for select using (user_id = auth.uid() or public.is_moderator());
create policy adaptation_submissions_insert on public.adaptation_mapping_submissions for insert
  with check (user_id = auth.uid() and status = 'pending' and reviewer_id is null and reviewed_at is null);
create policy adaptation_submissions_withdraw on public.adaptation_mapping_submissions for delete using (user_id = auth.uid() and status = 'pending');
