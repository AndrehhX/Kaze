"use client";

import type { BrowseParams, Character, MediaCard, MediaDetail, PageInfo } from "@/lib/anilist/types";
import { serializeBrowseParams } from "@/lib/anilist/browse-params";
import type { Suggestion } from "@/lib/anilist/service";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status);
  return body as T;
}

export const api = {
  browse: (p: BrowseParams, signal?: AbortSignal) => getJson<{ pageInfo: PageInfo; media: MediaCard[] }>(`/api/anilist/browse?${serializeBrowseParams(p)}`, signal),
  suggest: (q: string, signal?: AbortSignal) => getJson<{ results: Suggestion[] }>(`/api/anilist/suggest?q=${encodeURIComponent(q)}`, signal),
  media: (id: number, signal?: AbortSignal) => getJson<{ media: MediaDetail }>(`/api/anilist/media/${id}`, signal),
  recommendations: (id: number, signal?: AbortSignal) =>
    getJson<{ source: { id: number; title: MediaCard["title"]; genres: string[]; coverImage: { large: string | null; color: string | null } } | null; items: { rating: number; media: MediaCard }[]; relations: { relationType: string; node: MediaCard }[] }>(
      `/api/anilist/recommendations/${id}`,
      signal,
    ),
  batch: (ids: number[], signal?: AbortSignal) => getJson<{ media: MediaCard[] }>(`/api/anilist/batch?ids=${ids.join(",")}`, signal),
  character: (id: number, signal?: AbortSignal) => getJson<{ character: Character }>(`/api/anilist/character/${id}`, signal),
};
