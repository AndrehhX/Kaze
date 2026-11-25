-- ════════════════════════════════════════════════════════════════════
-- KAZE MANGA — ajustes al aplicar 20261120000000_kaze_manga.sql en producción (24/11/2026)
-- El esquema real no coincide al 100 % con las migraciones antiguas, así que:
--   1. touch_updated_at() se crea solo si no existe (la usa el trigger de manga_collections).
--   2. La actividad del manga en el feed de amigos nunca bloquea el guardado de la biblioteca:
--      si activity_events rechaza la fila (p. ej. otro CHECK en producción), se ignora.
-- En producción se ejecutó así, en una sola transacción:
--   begin;  <bloque 1 de este archivo>  <20261120000000_kaze_manga.sql>  <bloque 2>  commit;
-- ════════════════════════════════════════════════════════════════════

-- 1 ─────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'touch_updated_at' and pronamespace = 'public'::regnamespace) then
    create function public.touch_updated_at() returns trigger language plpgsql as $f$
    begin
      new.updated_at := now();
      return new;
    end;
    $f$;
  end if;
end;
$$;

-- 2 ─────────────────────────────────────────────────────────────────
create or replace function public.on_manga_library_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare snap jsonb := new.media_snapshot || jsonb_build_object('kind', 'manga');
begin
  if new.manga_id < 0 then return new; end if; -- las series demo no salen en el feed
  begin
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
  exception when others then
    null; -- el feed es secundario: el guardado de la biblioteca siempre gana
  end;
  return new;
end;
$$;
