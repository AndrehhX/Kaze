import { connection, type NextRequest } from "next/server";
import { setDigestEnabled, validUnsubscribeToken } from "@/lib/weekly-digest";
import { limitOrNull } from "@/lib/api-response";

/**
 * Baja del resumen semanal.
 *  - GET (el enlace del correo): muestra un botón "Confirmar baja". No da de baja solo con abrirlo,
 *    porque los filtros de correo abren los enlaces para revisarlos.
 *  - POST (el botón, o la baja en un clic de Gmail/Outlook vía List-Unsubscribe-Post): da de baja.
 */
const page = (title: string, body: string) =>
  new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Orunei</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0a14;font-family:Arial,sans-serif;color:#f4f1ff;padding:16px">
<main style="max-width:420px;width:100%;background:#14122a;border-radius:16px;padding:28px;text-align:center">
<div style="font-weight:800;color:#c084fc;letter-spacing:2px">KAZE 風</div>
<h1 style="font-size:20px;margin:16px 0 8px">${title}</h1>${body}
</main></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } },
  );

function params(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") ?? "";
  const t = req.nextUrl.searchParams.get("t") ?? "";
  return { u, t, ok: /^[0-9a-f-]{36}$/i.test(u) && validUnsubscribeToken(u, t) };
}

export async function GET(req: NextRequest) {
  await connection();
  const { u, t, ok } = params(req);
  if (!ok) return page("Enlace no válido", `<p style="color:#b9b3d1">Puedes desactivar el resumen desde Notificaciones en la web.</p>`);
  return page(
    "¿Dejar de recibir el resumen semanal?",
    `<p style="color:#b9b3d1;line-height:1.5">Seguirás recibiendo los avisos de la web y de la app; solo se apaga el correo de los domingos.</p>
<form method="post" action="/api/email/unsubscribe?u=${encodeURIComponent(u)}&t=${encodeURIComponent(t)}">
<button style="margin-top:12px;background:linear-gradient(90deg,#a855f7,#ec4899);color:#fff;border:0;border-radius:999px;padding:12px 22px;font-weight:700;font-size:15px;cursor:pointer">Confirmar baja</button></form>`,
  );
}

export async function POST(req: NextRequest) {
  await connection();
  const limited = limitOrNull(req, "unsubscribe", 20);
  if (limited) return limited;
  const { u, ok } = params(req);
  if (!ok) return page("Enlace no válido", `<p style="color:#b9b3d1">Puedes desactivar el resumen desde Notificaciones en la web.</p>`);
  try {
    await setDigestEnabled(u, false);
  } catch {
    return page("No se pudo completar", `<p style="color:#b9b3d1">Inténtalo de nuevo en un momento.</p>`);
  }
  return page("Listo, ya no te llegará", `<p style="color:#b9b3d1;line-height:1.5">Si cambias de idea, actívalo otra vez en Notificaciones.</p><a href="/" style="color:#c084fc">Volver a Orunei</a>`);
}
