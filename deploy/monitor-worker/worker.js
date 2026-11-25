/**
 * orunei-monitor — vigilante EXTERNO (corre en Cloudflare, no en la VPS).
 *
 * Cada 5 minutos comprueba que la web y el resolver respondan desde fuera.
 * Si la VPS entera se cae, este Worker sigue vivo y avisa a Discord.
 * Solo avisa cuando el estado cambia (cae / se recupera), tras 2 fallos seguidos.
 *
 * Secreto: DISCORD_ALERT_WEBHOOK_URL (wrangler secret put). Estado en KV `STATE`.
 * Desplegar: cd deploy/monitor-worker; npx wrangler deploy
 */

const CHECKS = [
  // ?_m= evita que la caché de Cloudflare responda por un origen caído.
  { key: "web", label: "Web www.orunei.sbs", url: "https://www.orunei.sbs/robots.txt" },
  { key: "home", label: "Portada de la web", url: "https://www.orunei.sbs/", expect: "KAZE" },
  { key: "resolver", label: "Resolver de video", url: "https://resolver.orunei.sbs/health" },
];

async function probe(check) {
  const started = Date.now();
  try {
    const u = new URL(check.url);
    u.searchParams.set("_m", String(started));
    const res = await fetch(u, {
      headers: { "user-agent": "orunei-monitor/1.0" },
      cf: { cacheTtl: 0, cacheEverything: false },
      signal: AbortSignal.timeout(15000),
    });
    const ms = Date.now() - started;
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status} en ${ms} ms` };
    if (check.expect) {
      const text = await res.text();
      if (!text.includes(check.expect)) return { ok: false, detail: `Responde (${ms} ms) pero sin el contenido esperado` };
    }
    return { ok: true, detail: `${ms} ms` };
  } catch (e) {
    return { ok: false, detail: e?.name === "TimeoutError" ? "Sin respuesta en 15 s" : String(e?.message || e) };
  }
}

async function notify(env, color, title, text) {
  if (!env.DISCORD_ALERT_WEBHOOK_URL) return;
  await fetch(env.DISCORD_ALERT_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "KAZE · monitor",
      embeds: [{ title, description: text, color, footer: { text: "Cloudflare · comprobación externa" }, timestamp: new Date().toISOString() }],
    }),
  }).catch(() => {});
}

async function run(env) {
  const results = await Promise.all(CHECKS.map(async (c) => ({ c, r: await probe(c) })));
  for (const { c, r } of results) {
    const prev = JSON.parse((await env.STATE.get(c.key)) || '{"fails":0,"down":false}');
    if (r.ok) {
      if (prev.down) {
        const mins = prev.since ? Math.round((Date.now() - prev.since) / 60000) : null;
        await notify(env, 3066993, `✅ Recuperado: ${c.label}`, `Vuelve a responder (${r.detail}).${mins ? ` Estuvo caído ~${mins} min.` : ""}`);
      }
      if (prev.fails || prev.down) await env.STATE.put(c.key, JSON.stringify({ fails: 0, down: false }));
      continue;
    }
    const fails = prev.fails + 1;
    const since = prev.since || Date.now();
    let down = prev.down;
    if (!down && fails >= 2) {
      down = true;
      await notify(env, 15158332, `🔴 Caído: ${c.label}`, `${r.detail}\n${c.url}\n\nSi la VPS no responde: \`ssh vps\` y \`systemctl status orunei-web\`. Si no entra por SSH, reinicia la VPS desde el panel del proveedor.`);
    }
    await env.STATE.put(c.key, JSON.stringify({ fails, down, since, last: r.detail }));
  }
  return results.map(({ c, r }) => ({ check: c.key, ...r }));
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(run(env));
  },
  // GET /  → estado actual (sin datos sensibles). Útil para mirar a mano.
  async fetch(_req, env) {
    const out = {};
    for (const c of CHECKS) out[c.key] = JSON.parse((await env.STATE.get(c.key)) || '{"fails":0,"down":false}');
    return Response.json(out);
  },
};
