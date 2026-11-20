/** GraphQL documents for MANGA-type media. They reuse the shared transport in ./client. */

export const MANGA_CARD_FIELDS = /* GraphQL */ `
  fragment MangaCard on Media {
    id
    idMal
    title { romaji english native userPreferred }
    coverImage { extraLarge large color }
    bannerImage
    format
    status
    chapters
    volumes
    averageScore
    meanScore
    popularity
    favourites
    genres
    isAdult
    countryOfOrigin
    startDate { year month day }
    endDate { year month day }
    staff(perPage: 2, sort: [RELEVANCE, ID]) { edges { role node { id name { full native } image { large } } } }
  }
`;

export const MANGA_HERO_FIELDS = /* GraphQL */ `
  fragment MangaHero on Media {
    ...MangaCard
    description(asHtml: false)
    tags { id name rank isMediaSpoiler }
    relations { edges { relationType(version: 2) node { id type format title { romaji english userPreferred } } } }
  }
`;

/** One round-trip for the manga home. Every section is a real AniList query; labels in the UI describe exactly what each sorts by. */
export const MANGA_HOME_QUERY = /* GraphQL */ `
  query MangaHome($recentFrom: FuzzyDateInt) {
    trending: Page(perPage: 10) {
      media(type: MANGA, isAdult: false, sort: TRENDING_DESC) { ...MangaHero }
    }
    popularMonth: Page(perPage: 12) {
      media(type: MANGA, isAdult: false, status: RELEASING, sort: [POPULARITY_DESC, ID_DESC]) { ...MangaCard }
    }
    topRated: Page(perPage: 12) {
      media(type: MANGA, isAdult: false, popularity_greater: 15000, sort: [SCORE_DESC, ID_DESC]) { ...MangaCard }
    }
    recentlyUpdated: Page(perPage: 12) {
      media(type: MANGA, isAdult: false, status: RELEASING, popularity_greater: 8000, sort: [UPDATED_AT_DESC]) { ...MangaCard }
    }
    completed: Page(perPage: 12) {
      media(type: MANGA, isAdult: false, status: FINISHED, sort: [POPULARITY_DESC, ID_DESC]) { ...MangaCard }
    }
    gems: Page(perPage: 12) {
      media(type: MANGA, isAdult: false, averageScore_greater: 78, popularity_greater: 2000, popularity_lesser: 25000, sort: [SCORE_DESC, ID_DESC]) { ...MangaCard }
    }
    newDiscoveries: Page(perPage: 12) {
      media(type: MANGA, isAdult: false, startDate_greater: $recentFrom, sort: [POPULARITY_DESC, ID_DESC]) { ...MangaCard }
    }
    shortReads: Page(perPage: 12) {
      media(type: MANGA, isAdult: false, status: FINISHED, chapters_lesser: 31, popularity_greater: 5000, format_in: [MANGA, ONE_SHOT], sort: [SCORE_DESC, ID_DESC]) { ...MangaCard }
    }
    longRunning: Page(perPage: 12) {
      media(type: MANGA, isAdult: false, chapters_greater: 199, sort: [POPULARITY_DESC, ID_DESC]) { ...MangaCard }
    }
    manhwa: Page(perPage: 12) {
      media(type: MANGA, isAdult: false, countryOfOrigin: "KR", sort: [POPULARITY_DESC, ID_DESC]) { ...MangaCard }
    }
  }
  ${MANGA_HERO_FIELDS}
  ${MANGA_CARD_FIELDS}
`;

export const MANGA_BROWSE_QUERY = /* GraphQL */ `
  query MangaBrowse(
    $page: Int
    $perPage: Int
    $search: String
    $genres: [String]
    $excludedGenres: [String]
    $tags: [String]
    $yearFrom: FuzzyDateInt
    $yearTo: FuzzyDateInt
    $formats: [MediaFormat]
    $status: MediaStatus
    $country: CountryCode
    $minScore: Int
    $minChapters: Int
    $maxChapters: Int
    $minVolumes: Int
    $maxVolumes: Int
    $minPopularity: Int
    $maxPopularity: Int
    $ids: [Int]
    $sort: [MediaSort]
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { total currentPage lastPage hasNextPage perPage }
      media(
        type: MANGA
        isAdult: false
        id_in: $ids
        search: $search
        genre_in: $genres
        genre_not_in: $excludedGenres
        tag_in: $tags
        startDate_greater: $yearFrom
        startDate_lesser: $yearTo
        format_in: $formats
        status: $status
        countryOfOrigin: $country
        averageScore_greater: $minScore
        chapters_greater: $minChapters
        chapters_lesser: $maxChapters
        volumes_greater: $minVolumes
        volumes_lesser: $maxVolumes
        popularity_greater: $minPopularity
        popularity_lesser: $maxPopularity
        sort: $sort
      ) { ...MangaCard }
    }
  }
  ${MANGA_CARD_FIELDS}
`;

/** Author/artist search: AniList exposes works through the Staff node. */
export const MANGA_STAFF_SEARCH_QUERY = /* GraphQL */ `
  query MangaByStaff($search: String, $page: Int, $perPage: Int) {
    Staff(search: $search) {
      id
      name { full native }
      staffMedia(type: MANGA, sort: [POPULARITY_DESC], page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage perPage }
        nodes { ...MangaCard }
      }
    }
  }
  ${MANGA_CARD_FIELDS}
`;

export const MANGA_SUGGEST_QUERY = /* GraphQL */ `
  query MangaSuggest($search: String) {
    Page(perPage: 8) {
      media(type: MANGA, isAdult: false, search: $search, sort: SEARCH_MATCH) {
        id
        title { romaji english native userPreferred }
        coverImage { large color }
        format
        status
        chapters
        volumes
        averageScore
        countryOfOrigin
        startDate { year }
      }
    }
  }
`;

export const MANGA_DETAIL_QUERY = /* GraphQL */ `
  query MangaDetail($id: Int) {
    Media(id: $id, type: MANGA) {
      ...MangaHero
      synonyms
      source
      siteUrl
      hashtag
      tags { id name rank category isMediaSpoiler isGeneralSpoiler }
      relations {
        edges {
          relationType(version: 2)
          node {
            id idMal type format status
            title { romaji english native userPreferred }
            coverImage { extraLarge large color }
            bannerImage
            averageScore
            popularity
            genres
            isAdult
            episodes
            chapters
            volumes
            seasonYear
            startDate { year month day }
          }
        }
      }
      recommendations(sort: RATING_DESC, perPage: 14) {
        nodes { rating mediaRecommendation { ...MangaCard type } }
      }
      characters(sort: [ROLE, RELEVANCE, ID], perPage: 16) {
        edges { role node { id name { full native } image { large } } }
      }
      allStaff: staff(sort: [RELEVANCE, ID], perPage: 10) {
        edges { role node { id name { full native } image { large } } }
      }
      externalLinks { id url site type language color icon isDisabled }
      rankings { id rank type context allTime year }
      stats {
        scoreDistribution { score amount }
        statusDistribution { status amount }
      }
      reviews(sort: RATING_DESC, perPage: 3) {
        nodes { id summary rating ratingAmount score siteUrl createdAt user { name avatar { medium } } }
      }
    }
  }
  ${MANGA_HERO_FIELDS}
  ${MANGA_CARD_FIELDS}
`;

export const MANGA_BATCH_QUERY = /* GraphQL */ `
  query MangaBatch($ids: [Int]) {
    Page(perPage: 50) {
      media(id_in: $ids, type: MANGA) { ...MangaCard }
    }
  }
  ${MANGA_CARD_FIELDS}
`;

/** Anime → original/related manga. Used by "Continue the story" when no verified mapping exists. */
export const ANIME_SOURCE_QUERY = /* GraphQL */ `
  query AnimeSource($id: Int) {
    Media(id: $id, type: ANIME) {
      id
      title { romaji english native userPreferred }
      coverImage { extraLarge large color }
      bannerImage
      format
      episodes
      seasonYear
      source
      status
      relations {
        edges {
          relationType(version: 2)
          node { ...MangaCard type }
        }
      }
    }
  }
  ${MANGA_CARD_FIELDS}
`;

export const MANGA_CHARACTER_QUERY = /* GraphQL */ `
  query MangaCharacter($id: Int) {
    Character(id: $id) {
      id
      name { full native alternative }
      image { large }
      description(asHtml: false)
      gender
      age
      favourites
      siteUrl
      media(sort: [POPULARITY_DESC], perPage: 18) {
        edges { characterRole node { ...MangaCard type } }
      }
    }
  }
  ${MANGA_CARD_FIELDS}
`;

export const VIEWER_MANGA_LIST_QUERY = /* GraphQL */ `
  query ViewerMangaList($userId: Int) {
    MediaListCollection(userId: $userId, type: MANGA) {
      lists {
        entries {
          id
          mediaId
          status
          score(format: POINT_100)
          progress
          progressVolumes
          repeat
          notes
          updatedAt
          startedAt { year month day }
          completedAt { year month day }
          media { ...MangaCard }
        }
      }
    }
  }
  ${MANGA_CARD_FIELDS}
`;

export const SAVE_MANGA_LIST_ENTRY_MUTATION = /* GraphQL */ `
  mutation SaveManga($mediaId: Int, $status: MediaListStatus, $progress: Int, $progressVolumes: Int, $scoreRaw: Int, $notes: String, $startedAt: FuzzyDateInput, $completedAt: FuzzyDateInput) {
    SaveMediaListEntry(mediaId: $mediaId, status: $status, progress: $progress, progressVolumes: $progressVolumes, scoreRaw: $scoreRaw, notes: $notes, startedAt: $startedAt, completedAt: $completedAt) {
      id
      mediaId
      status
      progress
      progressVolumes
      score(format: POINT_100)
      updatedAt
    }
  }
`;
