import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

/**
 * Minimal stand-in for the pieces of Supabase the migration depends on:
 * the auth schema, request-scoped auth.uid(), API roles, storage and the
 * realtime publication. Everything else is the real migration, unmodified.
 */
const SHIM = /* sql */ `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    email_confirmed_at timestamptz
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
  create publication supabase_realtime;
`;

const GRANTS = /* sql */ `
  grant usage on schema public, auth, storage to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
  grant select on all tables in schema public to anon;
  grant usage, select on all sequences in schema public to authenticated, service_role;
`;

export async function createDb() {
  const db = new PGlite({ extensions: { citext, pgcrypto } });
  const root = join(__dirname, "..", "..", "supabase");
  await db.exec(SHIM);
  await db.exec(readFileSync(join(root, "migrations", "20261029000000_kaze_schema.sql"), "utf8"));
  await db.exec(GRANTS);
  await db.exec(readFileSync(join(root, "seed.sql"), "utf8"));
  return db;
}

export type Db = Awaited<ReturnType<typeof createDb>>;

/** Creates an auth user (fires the real signup trigger) and returns its id. */
export async function signUp(db: Db, email: string, meta: Record<string, string> = {}) {
  const r = await db.query<{ id: string }>("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id", [email, JSON.stringify(meta)]);
  return r.rows[0].id;
}

/** Runs `fn` as an authenticated user (RLS enforced), or anonymously when id is null. */
export async function as<T>(db: Db, userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${userId ? "authenticated" : "anon"}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

export async function rows<T = Record<string, unknown>>(db: Db, sql: string, params: unknown[] = []) {
  return (await db.query<T>(sql, params)).rows;
}
