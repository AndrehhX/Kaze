/**
 * Low-level AniList GraphQL transport.
 * - De-duplicates identical in-flight requests.
 * - Fails fast on rate limits instead of sleeping Fluid CPU threads for 12s+.
 * - Never logs Authorization headers.
 */

export const ANILIST_ENDPOINT = "https://graphql.anilist.co";

export class AniListError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "AniListError";
  }
}

const inflight = new Map<string, Promise<unknown>>();
// Cache en memoria (TTL 30 min) para respuestas públicas de AniList: carga instantánea a 0ms.
const memoryCache = new Map<string, { data: unknown; expiresAt: number }>();

type FetchOptions = {
  token?: string;
  /** Max automatic retries on 5xx / transient network failures. */
  retries?: number;
  signal?: AbortSignal;
  /**
   * Guardar la respuesta en la Data Cache persistente de Next/Vercel (default: true).
   * Cada entrada nueva o revalidada cuenta como "ISR Write" en Vercel, así que las
   * consultas de una sola vez (autocompletado, búsquedas libres) deben pasar `false`.
   */
  persist?: boolean;
};

/** Revalidación de la Data Cache para consultas públicas: 1 día (antes 1 hora = 24× más ISR Writes). */
const PUBLIC_REVALIDATE_SECONDS = 86400;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function anilistRequest<T>(query: string, variables: Record<string, unknown> = {}, opts: FetchOptions = {}): Promise<T> {
  const body = JSON.stringify({ query, variables });
  // Never share in-flight requests between users.
  const key = opts.token ? null : body;

  // Si ya tenemos la respuesta en memoria y sigue vigente, responder instantáneamente
  if (key && !opts.token) {
    const hit = memoryCache.get(key);
    if (hit && Date.now() < hit.expiresAt) {
      return hit.data as T;
    }
  }

  if (key && inflight.has(key)) return inflight.get(key) as Promise<T>;

  const run = (async () => {
    const retries = opts.retries ?? 1;
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      const timeoutSignal = AbortSignal.timeout(8000);
      const signal = opts.signal ? AbortSignal.any([opts.signal, timeoutSignal]) : timeoutSignal;
      try {
        const fetchHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        };

        const fetchInit: RequestInit & { next?: { revalidate: number } } = {
          method: "POST",
          headers: fetchHeaders,
          body,
          signal,
        };

        if (opts.token || opts.persist === false) {
          fetchInit.cache = "no-store";
        } else {
          // Data Cache persistente de Next.js (sobrevive a deploys e instancias): 1 día.
          fetchInit.next = { revalidate: PUBLIC_REVALIDATE_SECONDS };
        }

        res = await fetch(ANILIST_ENDPOINT, fetchInit);
      } catch (err) {
        if (attempt < retries && !opts.signal?.aborted) {
          await sleep(400);
          continue;
        }
        throw new AniListError(`AniList is unreachable (${(err as Error).message})`, 0);
      }

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after") ?? "0");
        // Fast-fail if AniList says wait > 1s so Serverless Fluid Compute never hangs idle.
        if (attempt === 0 && retryAfter > 0 && retryAfter <= 1) {
          await sleep(retryAfter * 1000);
          continue;
        }
        throw new AniListError(
          "AniList rate limit reached. Please try again in a minute.",
          429,
          retryAfter || undefined,
        );
      }

      if (res.status >= 500) {
        if (attempt < retries) {
          await sleep(500);
          continue;
        }
        throw new AniListError(`AniList returned ${res.status}`, res.status);
      }

      const json = (await res.json().catch(() => null)) as { data?: T; errors?: { message: string; status?: number }[] } | null;
      if (!json) throw new AniListError("AniList returned an unreadable response", res.status);
      if (json.errors?.length) {
        const first = json.errors[0];
        // AniList returns 404 inside errors for unknown ids.
        throw new AniListError(first.message, first.status ?? res.status);
      }
      if (!res.ok || !json.data) throw new AniListError(`AniList request failed (${res.status})`, res.status);
      if (key && !opts.token) {
        memoryCache.set(key, { data: json.data, expiresAt: Date.now() + 30 * 60_000 });
        if (memoryCache.size > 500) {
          const firstKey = memoryCache.keys().next().value;
          if (firstKey) memoryCache.delete(firstKey);
        }
      }
      return json.data;
    }
  })();

  if (key) {
    inflight.set(key, run);
    run.finally(() => inflight.delete(key)).catch(() => {});
  }
  return run;
}
