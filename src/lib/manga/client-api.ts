"use client";

import type { MangaBrowseParams, MangaCard, MangaPage } from "@/lib/anilist/manga-types";
import { serializeMangaParams } from "@/lib/anilist/manga-params";
import type { MangaSuggestion } from "@/lib/anilist/manga-service";
import { ApiError } from "@/lib/api-client";

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status);
  return body as T;
}

export const mangaApi = {
  browse: (p: MangaBrowseParams | URLSearchParams, signal?: AbortSignal) => {
    const qs = p instanceof URLSearchParams ? p : serializeMangaParams(p);
    if (!(p instanceof URLSearchParams) && p.perPage) qs.set("perPage", String(p.perPage));
    return getJson<MangaPage>(`/api/manga/browse?${qs}`, signal);
  },
  suggest: (q: string, signal?: AbortSignal) => getJson<{ results: MangaSuggestion[] }>(`/api/manga/suggest?q=${encodeURIComponent(q)}`, signal),
  batch: (ids: number[], signal?: AbortSignal) => getJson<{ media: MangaCard[] }>(`/api/manga/batch?ids=${ids.join(",")}`, signal),
};
