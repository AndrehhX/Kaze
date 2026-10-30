/**
 * Low-level AniList GraphQL transport.
 * - De-duplicates identical in-flight requests.
 * - Honours 429 Retry-After with bounded retries.
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
// Cache en memoria (TTL 15 min) para respuestas públicas de AniList: carga instantánea a 0ms.
const memoryCache = new Map<string, { data: unknown; expiresAt: number }>();

type FetchOptions = {
  token?: string;
  /** Max automatic retries on 429/5xx. */
  retries?: number;
  signal?: AbortSignal;
};

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
    const retries = opts.retries ?? 2;
    for (let attempt = 0; ; attempt++) {
      let res: Response;
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
          signal: opts.signal,
        };

        if (opts.token) {
          fetchInit.cache = "no-store";
        } else {
          // Revalidación cada 15 min en Next.js Data Cache para peticiones públicas
          fetchInit.next = { revalidate: 900 };
        }

        res = await fetch(ANILIST_ENDPOINT, fetchInit);
      } catch (err) {
        if (attempt < retries && !opts.signal?.aborted) {
          await sleep(400 * 2 ** attempt);
          continue;
        }
        throw new AniListError(`AniList is unreachable (${(err as Error).message})`, 0);
      }

      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after") ?? "0");
        if (attempt < retries) {
          // Cap the wait so a request never hangs a render for long.
          await sleep(Math.min(Math.max(retryAfter, 1) * 1000, 6000));
          continue;
        }
        throw new AniListError(
          res.status === 429 ? "AniList rate limit reached. Please try again in a minute." : `AniList returned ${res.status}`,
          res.status,
          retryAfter || undefined,
        );
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
        memoryCache.set(key, { data: json.data, expiresAt: Date.now() + 15 * 60_000 });
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
