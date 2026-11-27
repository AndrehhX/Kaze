import { connection, NextResponse, type NextRequest } from "next/server";
import { handleKofiPayment, validKofiToken, type KofiPayload } from "@/lib/support/server";
import { limitOrNull } from "@/lib/api-response";

/**
 * Webhook de Ko-fi (Ko-fi → Configuración → API → URL del webhook: https://www.orunei.sbs/api/kofi/webhook).
 * Ko-fi manda un formulario con un campo `data` (JSON) que incluye el token de verificación.
 * Siempre respondemos rápido: si respondemos con error, Ko-fi reintenta.
 */
export async function POST(req: NextRequest) {
  await connection();
  const limited = limitOrNull(req, "kofi", 60);
  if (limited) return limited;
  let payload: KofiPayload | null = null;
  try {
    const type = req.headers.get("content-type") ?? "";
    if (type.includes("application/json")) {
      const body = (await req.json()) as { data?: string } & KofiPayload;
      payload = typeof body.data === "string" ? (JSON.parse(body.data) as KofiPayload) : body;
    } else {
      const form = await req.formData();
      const raw = form.get("data");
      payload = typeof raw === "string" ? (JSON.parse(raw) as KofiPayload) : null;
    }
  } catch {
    payload = null;
  }
  if (!payload) return NextResponse.json({ error: "Cuerpo no válido" }, { status: 400 });
  if (!validKofiToken(payload.verification_token)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const result = await handleKofiPayment(payload);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[kaze] kofi webhook", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Error al guardar" }, { status: 500 });
  }
}
