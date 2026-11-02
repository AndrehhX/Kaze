package com.kaze.mobile.data.anilist

/**
 * Hand-written, typed AniList GraphQL documents. We use plain OkHttp + kotlinx.serialization
 * instead of Apollo: the surface is small, it avoids a schema-download build step, and every
 * response is decoded into the typed DTOs in AniListDtos.kt.
 */
object AniListQueries {

    const val MEDIA_FIELDS = """
        id
        idMal
        title { romaji english native }
        coverImage { extraLarge large color }
        bannerImage
        averageScore
        popularity
        favourites
        genres
        tags { name rank isMediaSpoiler }
        format
        status
        episodes
        duration
        season
        seasonYear
        startDate { year month day }
        description(asHtml: false)
        isAdult
        studios(isMain: true) { nodes { name } }
        nextAiringEpisode { episode airingAt }
        trailer { id site }
    """

    /** All public home rails in ONE request using GraphQL aliases (batched, cache-friendly). */
    val HOME = """
        query Home(${'$'}season: MediaSeason, ${'$'}seasonYear: Int, ${'$'}nextSeason: MediaSeason, ${'$'}nextYear: Int, ${'$'}airedAfter: Int, ${'$'}airedBefore: Int) {
          trending: Page(page: 1, perPage: 20) { media(type: ANIME, sort: TRENDING_DESC, isAdult: false) { $MEDIA_FIELDS } }
          season: Page(page: 1, perPage: 20) { media(type: ANIME, season: ${'$'}season, seasonYear: ${'$'}seasonYear, sort: POPULARITY_DESC, isAdult: false) { $MEDIA_FIELDS } }
          upcoming: Page(page: 1, perPage: 20) { media(type: ANIME, season: ${'$'}nextSeason, seasonYear: ${'$'}nextYear, sort: POPULARITY_DESC, isAdult: false) { $MEDIA_FIELDS } }
          top: Page(page: 1, perPage: 20) { media(type: ANIME, sort: SCORE_DESC, isAdult: false) { $MEDIA_FIELDS } }
          gems: Page(page: 1, perPage: 20) { media(type: ANIME, sort: SCORE_DESC, averageScore_greater: 78, popularity_lesser: 60000, popularity_greater: 4000, isAdult: false) { $MEDIA_FIELDS } }
          favourites: Page(page: 1, perPage: 20) { media(type: ANIME, sort: FAVOURITES_DESC, isAdult: false) { $MEDIA_FIELDS } }
          aired: Page(page: 1, perPage: 30) {
            airingSchedules(airingAt_greater: ${'$'}airedAfter, airingAt_lesser: ${'$'}airedBefore, sort: TIME_DESC) {
              episode airingAt media { $MEDIA_FIELDS }
            }
          }
        }
    """.trimIndent()

    val SEARCH = """
        query Search(${'$'}page: Int, ${'$'}perPage: Int, ${'$'}search: String, ${'$'}genres: [String], ${'$'}excludedGenres: [String], ${'$'}tags: [String],
                     ${'$'}year: Int, ${'$'}season: MediaSeason, ${'$'}format: MediaFormat, ${'$'}status: MediaStatus, ${'$'}minScore: Int, ${'$'}sort: [MediaSort]) {
          Page(page: ${'$'}page, perPage: ${'$'}perPage) {
            pageInfo { currentPage hasNextPage }
            media(type: ANIME, search: ${'$'}search, genre_in: ${'$'}genres, genre_not_in: ${'$'}excludedGenres, tag_in: ${'$'}tags,
                  seasonYear: ${'$'}year, season: ${'$'}season, format: ${'$'}format, status: ${'$'}status,
                  averageScore_greater: ${'$'}minScore, sort: ${'$'}sort, isAdult: false) { $MEDIA_FIELDS }
          }
        }
    """.trimIndent()

    val DETAIL = """
        query Detail(${'$'}id: Int) {
          Media(id: ${'$'}id, type: ANIME) {
            $MEDIA_FIELDS
            synonyms
            source
            meanScore
            siteUrl
            endDate { year month day }
            rankings { rank type allTime season year context }
            stats { scoreDistribution { score amount } }
            externalLinks { site url type color language }
            streamingEpisodes { title thumbnail url site }
            characters(sort: [ROLE, RELEVANCE], perPage: 18) {
              edges {
                role
                node { id name { full native } image { large } }
                voiceActors(language: JAPANESE, sort: RELEVANCE) { id name { full native } image { large } languageV2 }
              }
            }
            staff(sort: RELEVANCE, perPage: 12) { edges { role node { id name { full native } image { large } languageV2 } } }
            relations { edges { relationType(version: 2) node { $MEDIA_FIELDS type } } }
            recommendations(sort: RATING_DESC, perPage: 15) { nodes { rating mediaRecommendation { $MEDIA_FIELDS } } }
            reviews(sort: RATING_DESC, perPage: 6) { nodes { id summary score rating ratingAmount createdAt user { name avatar { medium } } } }
          }
        }
    """.trimIndent()

    /** Lightweight graph query for the Similarity Explorer. */
    val GRAPH = """
        query Graph(${'$'}id: Int) {
          Media(id: ${'$'}id, type: ANIME) {
            $MEDIA_FIELDS
            relations { edges { relationType(version: 2) node { $MEDIA_FIELDS type } } }
            recommendations(sort: RATING_DESC, perPage: 10) { nodes { rating mediaRecommendation { $MEDIA_FIELDS } } }
          }
        }
    """.trimIndent()

    val GENRES = "query { GenreCollection MediaTagCollection { name category isAdult } }"

    val REVIEWS = """
        query Reviews(${'$'}page: Int, ${'$'}mediaId: Int) {
          Page(page: ${'$'}page, perPage: 15) {
            pageInfo { currentPage hasNextPage }
            reviews(mediaId: ${'$'}mediaId, mediaType: ANIME, sort: CREATED_AT_DESC) {
              id summary body(asHtml: false) score rating ratingAmount createdAt
              user { name avatar { medium } }
              media { id title { romaji english } coverImage { large color } }
            }
          }
        }
    """.trimIndent()

    val AIRING_FOR = """
        query Airing(${'$'}ids: [Int], ${'$'}after: Int, ${'$'}before: Int) {
          Page(perPage: 50) {
            airingSchedules(mediaId_in: ${'$'}ids, airingAt_greater: ${'$'}after, airingAt_lesser: ${'$'}before, sort: TIME) {
              episode airingAt media { $MEDIA_FIELDS }
            }
          }
        }
    """.trimIndent()

    val BY_IDS = """
        query ByIds(${'$'}ids: [Int], ${'$'}page: Int) {
          Page(page: ${'$'}page, perPage: 50) { media(id_in: ${'$'}ids, type: ANIME) { $MEDIA_FIELDS } }
        }
    """.trimIndent()

    // ---------- Authenticated (AniList OAuth token required) ----------

    const val VIEWER = "query { Viewer { id name avatar { large } bannerImage options { titleLanguage } } }"

    val VIEWER_LISTS = """
        query Lists(${'$'}userId: Int) {
          MediaListCollection(userId: ${'$'}userId, type: ANIME) {
            lists {
              entries {
                id status score(format: POINT_100) progress repeat updatedAt
                media { $MEDIA_FIELDS }
              }
            }
          }
          Viewer { favourites { anime(perPage: 50) { nodes { id } } } }
        }
    """.trimIndent()

    val SAVE_ENTRY = """
        mutation Save(${'$'}mediaId: Int, ${'$'}status: MediaListStatus, ${'$'}progress: Int, ${'$'}score: Float) {
          SaveMediaListEntry(mediaId: ${'$'}mediaId, status: ${'$'}status, progress: ${'$'}progress, score: ${'$'}score) { id status progress updatedAt }
        }
    """.trimIndent()
}
