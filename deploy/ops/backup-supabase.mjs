#!/usr/bin/env node
/**
 * Copia de seguridad diaria de Supabase, sin contraseña de la base de datos.
 *
 * Usa la clave de servicio (la misma que la web) para exportar:
 *   - todas las tablas y vistas del esquema public (PostgREST, por páginas),
 *   - las cuentas de Supabase Auth (API de administración),
 *   - una copia espejo de los archivos de Storage (solo descarga los nuevos).
 *
 * Resultado: /var/backups/orunei/db/AAAA-MM-DD.json.gz  (+ storage/<bucket>/...)
 * Nunca borra copias antiguas: el vigilante avisa si el disco se llena.
 *
 * Uso en la VPS (lo lanza /etc/cron.d/orunei-backup):
 *   set -a; . /opt/orunei-web/shared/.env; set +a; node /opt/orunei-ops/backup-supabase.mjs
 */
import { createWriteStream } from "node:fs";
import { mkdir, stat, writeFile, rename } from "node:fs/promises";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import path from "node:path";

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OUT = process.env.BACKUP_DIR || "/var/backups/orunei";
const PAGE = 1000;

if (!URL_BASE || !KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function getJson(url, init = {}, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { ...init, headers: { ...headers, ...(init.headers || {}) }, signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
      return await res.json();
    } catch (e) {
      if (i >= tries) throw new Error(`${url.replace(URL_BASE, "")}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
}

/** Tablas/vistas expuestas y sus claves primarias (para paginar en orden estable). */
async function listRelations() {
  const spec = await getJson(`${URL_BASE}/rest/v1/`);
  return Object.entries(spec.definitions || {}).map(([name, def]) => {
    const pk = Object.entries(def.properties || {})
      .filter(([, p]) => String(p.description || "").includes("<pk/>"))
      .map(([col]) => col);
    return { name, pk };
  });
}

async function dumpRelation({ name, pk }) {
  const rows = [];
  const order = pk.length ? `&order=${pk.map((c) => `${encodeURIComponent(c)}.asc`).join(",")}` : "";
  for (let offset = 0; ; offset += PAGE) {
    const page = await getJson(`${URL_BASE}/rest/v1/${encodeURIComponent(name)}?select=*${order}&limit=${PAGE}&offset=${offset}`);
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

async function dumpAuthUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const j = await getJson(`${URL_BASE}/auth/v1/admin/users?page=${page}&per_page=1000`);
    const list = j.users || [];
    users.push(...list);
    if (list.length < 1000) break;
  }
  return users;
}

/** Lista recursiva de objetos de un bucket. */
async function listObjects(bucket, prefix = "") {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const items = await getJson(`${URL_BASE}/storage/v1/object/list/${bucket}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: "name", order: "asc" } }),
    });
    for (const it of items) {
      const full = prefix ? `${prefix}/${it.name}` : it.name;
      if (it.id) out.push({ path: full, size: it.metadata?.size ?? null });
      else out.push(...(await listObjects(bucket, full))); // carpeta
    }
    if (items.length < 1000) break;
  }
  return out;
}

async function mirrorStorage() {
  const summary = {};
  const buckets = await getJson(`${URL_BASE}/storage/v1/bucket`);
  for (const b of buckets) {
    const objects = await listObjects(b.id);
    let downloaded = 0;
    for (const o of objects) {
      const dest = path.join(OUT, "storage", b.id, ...o.path.split("/"));
      if (!dest.startsWith(path.join(OUT, "storage", b.id))) continue; // nombres raros: no salir de la carpeta
      const prev = await stat(dest).catch(() => null);
      if (prev && (o.size == null || prev.size === o.size)) continue;
      const res = await fetch(`${URL_BASE}/storage/v1/object/${b.id}/${o.path.split("/").map(encodeURIComponent).join("/")}`, {
        headers,
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok || !res.body) throw new Error(`storage ${b.id}/${o.path}: ${res.status}`);
      await mkdir(path.dirname(dest), { recursive: true });
      await pipeline(Readable.fromWeb(res.body), createWriteStream(`${dest}.part`));
      await rename(`${dest}.part`, dest);
      downloaded++;
    }
    summary[b.id] = { objects: objects.length, downloaded };
  }
  return summary;
}

const started = Date.now();
const day = new Date().toISOString().slice(0, 10);
await mkdir(path.join(OUT, "db"), { recursive: true });

const relations = await listRelations();
const tables = {};
const counts = {};
for (const rel of relations) {
  tables[rel.name] = await dumpRelation(rel);
  counts[rel.name] = tables[rel.name].length;
}
const authUsers = await dumpAuthUsers();

const file = path.join(OUT, "db", `${day}.json.gz`);
const payload = JSON.stringify({ createdAt: new Date().toISOString(), source: URL_BASE, counts, authUsers, tables });
await pipeline(Readable.from([payload]), createGzip({ level: 9 }), createWriteStream(`${file}.part`));
await rename(`${file}.part`, file);

const storage = await mirrorStorage();
const size = (await stat(file)).size;
const status = {
  ok: true,
  finishedAt: new Date().toISOString(),
  seconds: Math.round((Date.now() - started) / 1000),
  file,
  bytes: size,
  tables: relations.length,
  rows: Object.values(counts).reduce((a, b) => a + b, 0),
  authUsers: authUsers.length,
  storage,
};
await writeFile(path.join(OUT, "last-backup.json"), JSON.stringify(status, null, 2));
console.log(JSON.stringify(status));
