package com.kaze.mobile.domain.model

import kotlinx.serialization.Serializable

/** Anime as shown in lists. All fields come from AniList; nullable fields are genuinely optional there. */
@Serializable
data class Anime(
    val id: Int,
    val title: String,
    val titleEnglish: String? = null,
    val titleNative: String? = null,
    val coverUrl: String? = null,
    val bannerUrl: String? = null,
    val color: String? = null,
    val score: Int? = null,
    val popularity: Int? = null,
    val favourites: Int? = null,
    val genres: List<String> = emptyList(),
    val tags: List<AnimeTag> = emptyList(),
    val format: String? = null,
    val status: String? = null,
    val episodes: Int? = null,
    val duration: Int? = null,
    val season: String? = null,
    val seasonYear: Int? = null,
    val startYear: Int? = null,
    val description: String? = null,
    val studios: List<String> = emptyList(),
    val nextEpisode: Int? = null,
    val nextAiringAt: Long? = null,
    val trailer: Trailer? = null,
    val isAdult: Boolean = false,
) {
    val displayTitle: String get() = titleEnglish?.takeIf { it.isNotBlank() } ?: title
    val formatLabel: String? get() = format?.let(::prettyEnum)
    val seasonLabel: String? get() = if (season != null && seasonYear != null) "${prettyEnum(season)} $seasonYear" else seasonYear?.toString()
}

@Serializable
data class AnimeTag(val name: String, val rank: Int = 0, val isSpoiler: Boolean = false)

@Serializable
data class Trailer(val site: String, val id: String) {
    /** Only YouTube/Dailymotion trailers are linkable; opened in the official app/browser. */
    val url: String? get() = when (site.lowercase()) {
        "youtube" -> "https://www.youtube.com/watch?v=$id"
        "dailymotion" -> "https://www.dailymotion.com/video/$id"
        else -> null
    }
}

data class AnimeDetail(
    val anime: Anime,
    val synonyms: List<String>,
    val source: String?,
    val startDate: String?,
    val endDate: String?,
    val meanScore: Int?,
    val siteUrl: String?,
    val characters: List<CharacterRole>,
    val staff: List<StaffRole>,
    val relations: List<Relation>,
    val recommendations: List<Recommendation>,
    val reviews: List<ReviewSummary>,
    val externalLinks: List<ExternalLink>,
    val streamingEpisodes: List<StreamingEpisode>,
    val rankings: List<String>,
    val scoreDistribution: List<Pair<Int, Int>>,
) {
    val streamingLinks: List<ExternalLink> get() = externalLinks.filter { it.type == "STREAMING" }
}

data class CharacterRole(
    val id: Int,
    val name: String,
    val nativeName: String?,
    val imageUrl: String?,
    val role: String,
    val voiceActor: Person?,
)

data class Person(val id: Int, val name: String, val nativeName: String?, val imageUrl: String?, val language: String?)

data class StaffRole(val person: Person, val role: String)

data class Relation(val type: String, val anime: Anime) {
    val label: String get() = prettyEnum(type)
}

data class Recommendation(val anime: Anime, val rating: Int)

data class ReviewSummary(
    val id: Int,
    val summary: String,
    val score: Int?,
    val rating: Int?,
    val ratingAmount: Int?,
    val userName: String,
    val userAvatar: String?,
    val createdAt: Long?,
    val body: String? = null,
    val mediaId: Int? = null,
    val mediaTitle: String? = null,
    val mediaCover: String? = null,
)

/** Official episode listing published by a licensed streaming site (title, thumbnail, link out). */
data class StreamingEpisode(val title: String, val thumbnail: String?, val url: String, val site: String) {
    /** AniList titles look like "Episode 3 - Title"; extract the number when present. */
    val number: Int? get() = Regex("(?i)episode\\s*(\\d+)").find(title)?.groupValues?.get(1)?.toIntOrNull()
}

data class ExternalLink(val site: String, val url: String, val type: String?, val color: String?, val language: String?)

data class AiringSlot(val anime: Anime, val episode: Int, val airingAt: Long)

data class PageResult<T>(val items: List<T>, val page: Int, val hasNextPage: Boolean)

/** The batched home payload: one GraphQL round trip for all public catalogue rails. */
data class HomeCatalog(
    val trending: List<Anime>,
    val popularSeason: List<Anime>,
    val recentlyReleased: List<AiringSlot>,
    val highestRated: List<Anime>,
    val upcoming: List<Anime>,
    val hiddenGems: List<Anime>,
    val communityFavorites: List<Anime>,
    val fetchedAt: Long,
    val fromCache: Boolean,
)

fun prettyEnum(value: String): String =
    when (value) {
        "TV" -> "TV"
        "TV_SHORT" -> "TV Short"
        "OVA", "ONA" -> value
        else -> value.lowercase().split('_').joinToString(" ") { it.replaceFirstChar(Char::titlecase) }
    }

enum class AnimeSeason { WINTER, SPRING, SUMMER, FALL;
    companion object {
        fun forMonth(month: Int): AnimeSeason = when (month) {
            12, 1, 2 -> WINTER
            3, 4, 5 -> SPRING
            6, 7, 8 -> SUMMER
            else -> FALL
        }
        /** AniList counts December as part of the *next* year's winter season. */
        fun current(nowMonth: Int, nowYear: Int): Pair<AnimeSeason, Int> {
            val s = forMonth(nowMonth)
            return s to (if (nowMonth == 12) nowYear + 1 else nowYear)
        }
    }
    fun next(year: Int): Pair<AnimeSeason, Int> = when (this) {
        WINTER -> SPRING to year
        SPRING -> SUMMER to year
        SUMMER -> FALL to year
        FALL -> WINTER to year + 1
    }
    fun previous(year: Int): Pair<AnimeSeason, Int> = when (this) {
        WINTER -> FALL to year - 1
        SPRING -> WINTER to year
        SUMMER -> SPRING to year
        FALL -> SUMMER to year
    }
}

/** Search & discovery filters mapped 1:1 to AniList Media query arguments. */
@Serializable
data class SearchFilters(
    val query: String = "",
    val genres: Set<String> = emptySet(),
    val excludedGenres: Set<String> = emptySet(),
    val tags: Set<String> = emptySet(),
    val year: Int? = null,
    val season: String? = null,
    val format: String? = null,
    val status: String? = null,
    val minScore: Int? = null,
    val sort: SearchSort = SearchSort.POPULARITY_DESC,
) {
    val isEmpty: Boolean get() = query.isBlank() && genres.isEmpty() && excludedGenres.isEmpty() && tags.isEmpty() &&
        year == null && season == null && format == null && status == null && minScore == null
    val activeCount: Int get() = genres.size + excludedGenres.size + tags.size + listOfNotNull(year, season, format, status, minScore).size
}

@Serializable
enum class SearchSort(val label: String, val apiValue: String) {
    POPULARITY_DESC("Most popular", "POPULARITY_DESC"),
    SCORE_DESC("Highest rated", "SCORE_DESC"),
    TRENDING_DESC("Trending", "TRENDING_DESC"),
    START_DATE_DESC("Newest", "START_DATE_DESC"),
    FAVOURITES_DESC("Most favourited", "FAVOURITES_DESC"),
    TITLE_ROMAJI("Title A–Z", "TITLE_ROMAJI"),
}

object AniListCatalog {
    /** AniList's genre collection (stable list; also fetched live via GenreCollection). */
    val genres = listOf(
        "Action", "Adventure", "Comedy", "Drama", "Ecchi", "Fantasy", "Horror", "Mahou Shoujo", "Mecha",
        "Music", "Mystery", "Psychological", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller",
    )
    val formats = listOf("TV", "TV_SHORT", "MOVIE", "SPECIAL", "OVA", "ONA", "MUSIC")
    val statuses = listOf("RELEASING", "FINISHED", "NOT_YET_RELEASED", "CANCELLED", "HIATUS")
}
