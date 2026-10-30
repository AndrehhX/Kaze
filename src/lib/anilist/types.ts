/** Typed subset of the AniList GraphQL schema used by KAZE. */

export type MediaSeason = "WINTER" | "SPRING" | "SUMMER" | "FALL";
export type MediaFormat = "TV" | "TV_SHORT" | "MOVIE" | "SPECIAL" | "OVA" | "ONA" | "MUSIC";
export type MediaStatus = "FINISHED" | "RELEASING" | "NOT_YET_RELEASED" | "CANCELLED" | "HIATUS";
export type MediaSource =
  | "ORIGINAL"
  | "MANGA"
  | "LIGHT_NOVEL"
  | "VISUAL_NOVEL"
  | "VIDEO_GAME"
  | "OTHER"
  | "NOVEL"
  | "DOUJINSHI"
  | "ANIME"
  | "WEB_NOVEL"
  | "LIVE_ACTION"
  | "GAME"
  | "COMIC"
  | "MULTIMEDIA_PROJECT"
  | "PICTURE_BOOK";
export type MediaListStatus = "CURRENT" | "PLANNING" | "COMPLETED" | "DROPPED" | "PAUSED" | "REPEATING";

export type FuzzyDate = { year: number | null; month: number | null; day: number | null };

export type MediaTitle = {
  romaji: string | null;
  english: string | null;
  native: string | null;
  userPreferred: string | null;
};

export type MediaCard = {
  id: number;
  idMal: number | null;
  title: MediaTitle;
  coverImage: { extraLarge: string | null; large: string | null; color: string | null };
  bannerImage: string | null;
  format: MediaFormat | null;
  status: MediaStatus | null;
  episodes: number | null;
  duration: number | null;
  season: MediaSeason | null;
  seasonYear: number | null;
  averageScore: number | null;
  meanScore: number | null;
  popularity: number | null;
  favourites: number | null;
  genres: string[];
  isAdult: boolean;
  startDate: FuzzyDate;
  nextAiringEpisode: { episode: number; airingAt: number; timeUntilAiring: number } | null;
  studios: { nodes: { id: number; name: string }[] };
};

export type MediaHero = MediaCard & {
  description: string | null;
  trailer: { id: string; site: string; thumbnail: string | null } | null;
};

export type MediaTag = {
  id: number;
  name: string;
  rank: number;
  category: string;
  isMediaSpoiler: boolean;
  isGeneralSpoiler: boolean;
};

export type CharacterEdge = {
  role: "MAIN" | "SUPPORTING" | "BACKGROUND";
  node: { id: number; name: { full: string; native: string | null }; image: { large: string | null } };
  voiceActors: {
    id: number;
    name: { full: string; native: string | null };
    image: { large: string | null };
    languageV2: string | null;
  }[];
};

export type StaffEdge = {
  role: string;
  node: { id: number; name: { full: string; native: string | null }; image: { large: string | null } };
};

export type RelationEdge = { relationType: string; node: MediaCard & { type: "ANIME" | "MANGA" } };

export type ExternalLink = {
  id: number;
  url: string;
  site: string;
  type: "INFO" | "STREAMING" | "SOCIAL" | null;
  language: string | null;
  color: string | null;
  icon: string | null;
  isDisabled: boolean | null;
};

export type StreamingEpisode = { title: string | null; thumbnail: string | null; url: string | null; site: string | null };

export type AniListReview = {
  id: number;
  summary: string | null;
  rating: number | null;
  ratingAmount: number | null;
  score: number | null;
  siteUrl: string;
  createdAt: number;
  user: { name: string; avatar: { medium: string | null } };
};

export type MediaDetail = MediaHero & {
  synonyms: string[];
  source: MediaSource | null;
  countryOfOrigin: string | null;
  hashtag: string | null;
  endDate: FuzzyDate;
  siteUrl: string;
  tags: MediaTag[];
  allStudios: { edges: { isMain: boolean; node: { id: number; name: string; isAnimationStudio: boolean } }[] };
  relations: { edges: RelationEdge[] };
  recommendations: { nodes: { rating: number; mediaRecommendation: MediaCard | null }[] };
  characters: { edges: CharacterEdge[] };
  staff: { edges: StaffEdge[] };
  streamingEpisodes: StreamingEpisode[];
  externalLinks: ExternalLink[];
  rankings: { id: number; rank: number; type: "RATED" | "POPULAR"; context: string; allTime: boolean; year: number | null; season: MediaSeason | null }[];
  stats: {
    scoreDistribution: { score: number; amount: number }[];
    statusDistribution: { status: MediaListStatus; amount: number }[];
  } | null;
  airingSchedule: { nodes: { episode: number; airingAt: number }[] };
  reviews: { nodes: AniListReview[] };
};

export type AiringItem = { id: number; episode: number; airingAt: number; media: MediaCard };

export type PageInfo = { total: number; currentPage: number; lastPage: number; hasNextPage: boolean; perPage: number };

export type HomeData = {
  trending: MediaHero[];
  season: MediaHero[];
  top: MediaCard[];
  gems: MediaCard[];
  upcoming: MediaCard[];
  favourites: MediaCard[];
  recent: AiringItem[];
  seasonInfo: { season: MediaSeason; year: number };
};

export type BrowseSort =
  | "TRENDING_DESC"
  | "POPULARITY_DESC"
  | "SCORE_DESC"
  | "FAVOURITES_DESC"
  | "START_DATE_DESC"
  | "START_DATE"
  | "TITLE_ROMAJI"
  | "EPISODES_DESC"
  | "SEARCH_MATCH";

export type BrowseParams = {
  search?: string;
  genres?: string[];
  tags?: string[];
  excludedGenres?: string[];
  year?: number;
  yearFrom?: number;
  yearTo?: number;
  season?: MediaSeason;
  formats?: MediaFormat[];
  status?: MediaStatus;
  minScore?: number;
  minEpisodes?: number;
  maxEpisodes?: number;
  minPopularity?: number;
  maxPopularity?: number;
  source?: MediaSource;
  studio?: string;
  sort?: BrowseSort;
  page?: number;
  perPage?: number;
};

export type Character = {
  id: number;
  name: { full: string; native: string | null; alternative: string[] };
  image: { large: string | null };
  description: string | null;
  gender: string | null;
  age: string | null;
  dateOfBirth: FuzzyDate;
  favourites: number | null;
  siteUrl: string;
};

export type AniListViewer = {
  id: number;
  name: string;
  avatar: { large: string | null };
  bannerImage: string | null;
  siteUrl: string;
  statistics: {
    anime: {
      count: number;
      meanScore: number;
      minutesWatched: number;
      episodesWatched: number;
      genres: { genre: string; count: number; meanScore: number; minutesWatched: number }[];
      formats: { format: string; count: number }[];
      statuses: { status: string; count: number }[];
      studios: { studio: { name: string }; count: number }[];
      releaseYears: { releaseYear: number; count: number }[];
    };
  };
};

export type AniListListEntry = {
  id: number;
  mediaId: number;
  status: MediaListStatus;
  score: number;
  progress: number;
  repeat: number;
  notes: string | null;
  updatedAt: number;
  startedAt: FuzzyDate;
  completedAt: FuzzyDate;
  media: MediaCard;
};
