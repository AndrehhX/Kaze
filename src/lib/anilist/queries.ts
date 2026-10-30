export const CARD_FIELDS = /* GraphQL */ `
  fragment Card on Media {
    id
    idMal
    title { romaji english native userPreferred }
    coverImage { extraLarge large color }
    bannerImage
    format
    status
    episodes
    duration
    season
    seasonYear
    averageScore
    meanScore
    popularity
    favourites
    genres
    isAdult
    startDate { year month day }
    nextAiringEpisode { episode airingAt timeUntilAiring }
    studios(isMain: true) { nodes { id name } }
  }
`;

export const HERO_FIELDS = /* GraphQL */ `
  fragment Hero on Media {
    ...Card
    description(asHtml: false)
    trailer { id site thumbnail }
  }
`;

/** One round-trip for the whole home page (AniList allows aliased Page queries). */
export const HOME_QUERY = /* GraphQL */ `
  query Home($season: MediaSeason, $year: Int, $from: Int, $to: Int) {
    trending: Page(perPage: 14) {
      media(sort: TRENDING_DESC, type: ANIME, isAdult: false) { ...Hero }
    }
    season: Page(perPage: 14) {
      media(season: $season, seasonYear: $year, sort: POPULARITY_DESC, type: ANIME, isAdult: false) { ...Hero }
    }
    top: Page(perPage: 12) {
      media(sort: SCORE_DESC, type: ANIME, isAdult: false, popularity_greater: 20000) { ...Card }
    }
    gems: Page(perPage: 12) {
      media(sort: SCORE_DESC, type: ANIME, isAdult: false, averageScore_greater: 77, popularity_lesser: 45000, popularity_greater: 4000, format_in: [TV, MOVIE, ONA]) { ...Card }
    }
    upcoming: Page(perPage: 12) {
      media(sort: POPULARITY_DESC, type: ANIME, isAdult: false, status: NOT_YET_RELEASED) { ...Card }
    }
    favourites: Page(perPage: 12) {
      media(sort: FAVOURITES_DESC, type: ANIME, isAdult: false) { ...Card }
    }
    recent: Page(perPage: 24) {
      airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME_DESC) {
        id
        episode
        airingAt
        media { ...Card }
      }
    }
  }
  ${HERO_FIELDS}
  ${CARD_FIELDS}
`;

export const BROWSE_QUERY = /* GraphQL */ `
  query Browse(
    $page: Int
    $perPage: Int
    $search: String
    $genres: [String]
    $excludedGenres: [String]
    $tags: [String]
    $year: Int
    $yearFrom: FuzzyDateInt
    $yearTo: FuzzyDateInt
    $season: MediaSeason
    $formats: [MediaFormat]
    $status: MediaStatus
    $minScore: Int
    $minEpisodes: Int
    $maxEpisodes: Int
    $minPopularity: Int
    $maxPopularity: Int
    $source: MediaSource
    $sort: [MediaSort]
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { total currentPage lastPage hasNextPage perPage }
      media(
        type: ANIME
        isAdult: false
        search: $search
        genre_in: $genres
        genre_not_in: $excludedGenres
        tag_in: $tags
        seasonYear: $year
        startDate_greater: $yearFrom
        startDate_lesser: $yearTo
        season: $season
        format_in: $formats
        status: $status
        averageScore_greater: $minScore
        episodes_greater: $minEpisodes
        episodes_lesser: $maxEpisodes
        popularity_greater: $minPopularity
        popularity_lesser: $maxPopularity
        source: $source
        sort: $sort
      ) { ...Card }
    }
  }
  ${CARD_FIELDS}
`;

export const STUDIO_SEARCH_QUERY = /* GraphQL */ `
  query StudioMedia($search: String, $page: Int, $perPage: Int) {
    Studio(search: $search) {
      id
      name
      media(sort: POPULARITY_DESC, page: $page, perPage: $perPage, isMain: true) {
        pageInfo { total currentPage lastPage hasNextPage perPage }
        nodes { ...Card }
      }
    }
  }
  ${CARD_FIELDS}
`;

export const SUGGEST_QUERY = /* GraphQL */ `
  query Suggest($search: String) {
    Page(perPage: 8) {
      media(type: ANIME, isAdult: false, search: $search, sort: SEARCH_MATCH) {
        id
        title { romaji english native userPreferred }
        coverImage { large color }
        format
        seasonYear
        averageScore
        episodes
        status
      }
    }
  }
`;

export const DETAIL_QUERY = /* GraphQL */ `
  query Detail($id: Int) {
    Media(id: $id, type: ANIME) {
      ...Hero
      synonyms
      source
      countryOfOrigin
      hashtag
      siteUrl
      endDate { year month day }
      tags { id name rank category isMediaSpoiler isGeneralSpoiler }
      allStudios: studios { edges { isMain node { id name isAnimationStudio } } }
      relations {
        edges {
          relationType(version: 2)
          node { ...Card type }
        }
      }
      recommendations(sort: RATING_DESC, perPage: 18) {
        nodes { rating mediaRecommendation { ...Card } }
      }
      characters(sort: [ROLE, RELEVANCE, ID], perPage: 18) {
        edges {
          role
          node { id name { full native } image { large } }
          voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) { id name { full native } image { large } languageV2 }
        }
      }
      staff(sort: [RELEVANCE, ID], perPage: 12) {
        edges { role node { id name { full native } image { large } } }
      }
      streamingEpisodes { title thumbnail url site }
      externalLinks { id url site type language color icon isDisabled }
      rankings { id rank type context allTime year season }
      stats {
        scoreDistribution { score amount }
        statusDistribution { status amount }
      }
      airingSchedule(perPage: 50) { nodes { episode airingAt } }
      reviews(sort: RATING_DESC, perPage: 4) {
        nodes { id summary rating ratingAmount score siteUrl createdAt user { name avatar { medium } } }
      }
    }
  }
  ${HERO_FIELDS}
  ${CARD_FIELDS}
`;

export const RECOMMENDATIONS_QUERY = /* GraphQL */ `
  query Recs($id: Int) {
    Media(id: $id, type: ANIME) {
      id
      title { romaji english native userPreferred }
      coverImage { large color }
      genres
      recommendations(sort: RATING_DESC, perPage: 14) {
        nodes { rating mediaRecommendation { ...Card } }
      }
      relations { edges { relationType(version: 2) node { ...Card type } } }
    }
  }
  ${CARD_FIELDS}
`;

export const MEDIA_BATCH_QUERY = /* GraphQL */ `
  query Batch($ids: [Int]) {
    Page(perPage: 50) {
      media(id_in: $ids, type: ANIME) { ...Card }
    }
  }
  ${CARD_FIELDS}
`;

export const CHARACTER_QUERY = /* GraphQL */ `
  query Character($id: Int) {
    Character(id: $id) {
      id
      name { full native alternative }
      image { large }
      description(asHtml: false)
      gender
      age
      dateOfBirth { year month day }
      favourites
      siteUrl
    }
  }
`;

export const META_QUERY = /* GraphQL */ `
  query Meta {
    GenreCollection
    MediaTagCollection { name category isAdult description }
  }
`;

export const VIEWER_QUERY = /* GraphQL */ `
  query Viewer {
    Viewer {
      id
      name
      avatar { large }
      bannerImage
      siteUrl
      statistics {
        anime {
          count
          meanScore
          minutesWatched
          episodesWatched
          genres(limit: 12, sort: COUNT_DESC) { genre count meanScore minutesWatched }
          formats(sort: COUNT_DESC) { format count }
          statuses { status count }
          studios(limit: 8, sort: COUNT_DESC) { studio { name } count }
          releaseYears(limit: 30, sort: ID_DESC) { releaseYear count }
        }
      }
    }
  }
`;

export const VIEWER_LIST_QUERY = /* GraphQL */ `
  query ViewerList($userId: Int) {
    MediaListCollection(userId: $userId, type: ANIME) {
      lists {
        entries {
          id
          mediaId
          status
          score(format: POINT_100)
          progress
          repeat
          notes
          updatedAt
          startedAt { year month day }
          completedAt { year month day }
          media { ...Card }
        }
      }
    }
  }
  ${CARD_FIELDS}
`;

export const SAVE_LIST_ENTRY_MUTATION = /* GraphQL */ `
  mutation Save($mediaId: Int, $status: MediaListStatus, $progress: Int, $scoreRaw: Int, $notes: String, $startedAt: FuzzyDateInput, $completedAt: FuzzyDateInput) {
    SaveMediaListEntry(mediaId: $mediaId, status: $status, progress: $progress, scoreRaw: $scoreRaw, notes: $notes, startedAt: $startedAt, completedAt: $completedAt) {
      id
      mediaId
      status
      progress
      score(format: POINT_100)
      updatedAt
    }
  }
`;

export const VIEWER_FAVOURITES_QUERY = /* GraphQL */ `
  query Favs {
    Viewer {
      favourites {
        anime(perPage: 25) { nodes { ...Card } }
        characters(perPage: 25) { nodes { id name { full native } image { large } } }
      }
    }
  }
  ${CARD_FIELDS}
`;
