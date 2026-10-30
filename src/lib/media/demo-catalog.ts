import type { CatalogSeries, MediaProvider } from "./types";

/**
 * KAZE Open Cinema — the authorized demo catalog.
 *
 * Every title is a Blender Foundation open movie released under Creative
 * Commons Attribution, streamed from public test endpoints that their
 * operators (Mux, Apple, Unified Streaming) publish for player testing.
 * None of these are anime, and none are presented as AniList catalog entries.
 *
 * Timing markers are KAZE catalog metadata authored for this demo; they mark
 * the opening titles and closing credits of each film.
 */
const BLENDER = "https://studio.blender.org/films/";

export const DEMO_SERIES: CatalogSeries[] = [
  {
    id: "open-cinema",
    title: "KAZE Open Cinema",
    titleJp: "オープンシネマ",
    description:
      "A demo programme of open-licensed short films used to exercise the KAZE player: adaptive HLS, multiple renditions, subtitle tracks, alternate audio, resume, skip markers and synchronized watch parties.",
    banner: null,
    cover: null,
    color: "#a855f7",
    provider: "demo",
    license: {
      name: "CC BY 3.0",
      url: "https://creativecommons.org/licenses/by/3.0/",
      attribution: "Films © Blender Foundation | blender.org — streamed via public player-test endpoints.",
    },
    anilistId: null,
    demo: true,
    episodes: [
      {
        id: "1",
        number: 1,
        title: "Big Buck Bunny",
        synopsis:
          "A giant, gentle rabbit is pushed too far by three bullying rodents and plans a comic revenge. (Blender Foundation, 2008.)",
        thumbnail: null,
        asset: {
          id: "bbb-mux",
          kind: "hls",
          src: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
          subtitles: [{ label: "English (KAZE demo captions)", lang: "en", src: "/demo/subtitles/big-buck-bunny.en.vtt", default: false }],
          markers: [
            { kind: "intro", start: 0, end: 24 },
            { kind: "outro", start: 490, end: 596 },
          ],
          duration: 596,
        },
      },
      {
        id: "2",
        number: 2,
        title: "Tears of Steel",
        synopsis:
          "In a future Amsterdam, a group of scientists attempts to rescue the world from destructive robots by revisiting a painful breakup. (Blender Foundation, 2012.)",
        thumbnail: null,
        asset: {
          id: "tos-mux",
          kind: "hls",
          src: "https://test-streams.mux.dev/tos_ismc/main.m3u8",
          subtitles: [],
          markers: [
            { kind: "intro", start: 0, end: 15 },
            { kind: "outro", start: 640, end: 734 },
          ],
          duration: 734,
        },
      },
      {
        id: "3",
        number: 3,
        title: "Tears of Steel — Adaptive Ladder",
        synopsis:
          "The same film delivered as a five-step adaptive bitrate ladder. Use it to test quality switching and the playback statistics panel.",
        thumbnail: null,
        asset: {
          id: "tos-usp",
          kind: "hls",
          src: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
          subtitles: [],
          markers: [
            { kind: "intro", start: 0, end: 15 },
            { kind: "outro", start: 640, end: 734 },
          ],
          duration: 734,
        },
      },
      {
        id: "4",
        number: 4,
        title: "Signal Test: Bip-Bop",
        synopsis:
          "Apple's reference HLS stream: a test pattern with many renditions, alternate audio and multiple subtitle languages. Not a film — a technical check for track selection.",
        thumbnail: null,
        asset: {
          id: "apple-bipbop",
          kind: "hls",
          src: "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8",
          subtitles: [],
          markers: [],
          duration: 600,
        },
      },
    ],
  },
];

export const BLENDER_FILMS_URL = BLENDER;

export const demoProvider: MediaProvider = {
  id: "demo",
  async listSeries() {
    return DEMO_SERIES;
  },
  async getSeries(seriesId) {
    return DEMO_SERIES.find((s) => s.id === seriesId) ?? null;
  },
  async findByAniListId(anilistId) {
    return DEMO_SERIES.find((s) => s.anilistId === anilistId) ?? null;
  },
  async checkEntitlement({ seriesId, episodeId }) {
    const series = DEMO_SERIES.find((s) => s.id === seriesId);
    if (!series) return { allowed: false, reason: "not-licensed" };
    if (!series.episodes.some((e) => e.id === episodeId)) return { allowed: false, reason: "unknown-episode" };
    // Open-licensed demo content is available to everyone, signed in or not.
    return { allowed: true, reason: "demo-open-license" };
  },
};
