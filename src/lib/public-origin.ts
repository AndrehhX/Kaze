import type { NextRequest } from "next/server";
import { siteUrl } from "@/lib/env";

/**
 * Origen público para construir redirecciones.
 *
 * Detrás de Cloudflare + Caddy (VPS), `req.nextUrl.origin` devuelve la dirección interna
 * del servidor (p. ej. https://localhost:3000), no el dominio real. En producción se usa
 * la URL pública del sitio; en desarrollo, la de la propia petición.
 */
export function publicOrigin(req: NextRequest): string {
  return process.env.NODE_ENV === "production" ? new URL(siteUrl).origin : req.nextUrl.origin;
}
