import "server-only";
import { NextResponse } from "next/server";
import { AniListError } from "@/lib/anilist/client";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export function json<T>(data: T, init?: { status?: number; cache?: string }) {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: { "Cache-Control": init?.cache ?? "no-store" },
  });
}

export function errorResponse(err: unknown) {
  if (err instanceof AniListError) {
    const status = err.status === 429 ? 503 : err.status === 404 ? 404 : 502;
    return NextResponse.json(
      { error: err.message, source: "anilist" },
      { status, headers: err.retryAfter ? { "Retry-After": String(err.retryAfter) } : undefined },
    );
  }
  console.error("[kaze] api error", err instanceof Error ? err.message : err);
  return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
}

/** Returns a 429 response when the caller exceeds the limit, otherwise null. */
export function limitOrNull(req: Request, scope: string, limit = 60, windowMs = 60_000) {
  const r = rateLimit(clientKey(req, scope), limit, windowMs);
  if (r.ok) return null;
  return NextResponse.json({ error: "Too many requests. Slow down a little." }, { status: 429, headers: { "Retry-After": String(r.retryAfter) } });
}

export function parseId(raw: string): number | null {
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 && String(id) === raw ? id : null;
}
