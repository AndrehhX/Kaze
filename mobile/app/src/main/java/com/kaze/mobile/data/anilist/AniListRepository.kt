package com.kaze.mobile.data.anilist

import com.kaze.mobile.core.common.KazeError
import com.kaze.mobile.core.common.Loadable
import com.kaze.mobile.core.common.Outcome
import com.kaze.mobile.core.common.outcomeOf
import com.kaze.mobile.core.common.toKazeError
import com.kaze.mobile.core.database.CacheDao
import com.kaze.mobile.core.database.CachedQueryEntity
import com.kaze.mobile.domain.model.AiringSlot
import com.kaze.mobile.domain.model.Anime
import com.kaze.mobile.domain.model.AnimeDetail
import com.kaze.mobile.domain.model.AnimeSeason
import com.kaze.mobile.domain.model.HomeCatalog
import com.kaze.mobile.domain.model.PageResult
import com.kaze.mobile.domain.model.ReviewSummary
import com.kaze.mobile.domain.model.SearchFilters
import com.kaze.mobile.domain.model.SearchSort
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.serialization.KSerializer
import java.time.LocalDate
import java.time.ZoneId
import javax.inject.Inject
import javax.inject.Singleton

fun interface Clock { fun nowMillis(): Long }

/**
 * Catalogue access with stale-while-revalidate caching in Room:
 * cached JSON is emitted immediately (offline browsing), then refreshed from AniList.
 */
@Singleton
class AniListRepository @Inject constructor(
    private val client: AniListClient,
    private val cache: CacheDao,
    private val clock: Clock,
) {
    private val homeTtlMs = 15 * 60_000L
    private val detailTtlMs = 6 * 60 * 60_000L

    fun home(forceRefresh: Boolean = false): Flow<Loadable<HomeCatalog>> = flow {
        val today = LocalDate.now(ZoneId.systemDefault())
        val (season, year) = AnimeSeason.current(today.monthValue, today.year)
        val (nextSeason, nextYear) = season.next(year)
        val key = "home:$season:$year"
        val cached = cache.get(key)
        val cachedHome = cached?.let { runCatching { mapHome(client.decode(it.json.toJson(), HomeData.serializer()), it.fetchedAt, true) }.getOrNull() }
        if (cachedHome != null) {
            val fresh = clock.nowMillis() - cached.fetchedAt < homeTtlMs
            emit(Loadable(cachedHome, loading = !fresh || forceRefresh, stale = true))
            if (fresh && !forceRefresh) return@flow
        } else emit(Loadable(loading = true))

        val now = clock.nowMillis() / 1000
        val vars = mapOf(
            "season" to season.name, "seasonYear" to year,
            "nextSeason" to nextSeason.name, "nextYear" to nextYear,
            "airedAfter" to (now - 7 * 86_400), "airedBefore" to now,
        )
        try {
            val result = client.execute(AniListQueries.HOME, vars, HomeData.serializer())
            val fetchedAt = clock.nowMillis()
            cache.put(CachedQueryEntity(key, result.raw.toString(), fetchedAt))
            emit(Loadable(mapHome(result.data, fetchedAt, false)))
        } catch (c: CancellationException) {
            throw c
        } catch (t: Throwable) {
            emit(Loadable(cachedHome, error = t.toKazeError(), stale = cachedHome != null))
        }
    }

    private fun mapHome(d: HomeData, fetchedAt: Long, fromCache: Boolean): HomeCatalog {
        fun PageDto?.anime() = this?.media.orEmpty().filterNot { it.isAdult == true }.map { it.toAnime() }
        return HomeCatalog(
            trending = d.trending.anime(),
            popularSeason = d.season.anime(),
            recentlyReleased = d.aired?.airingSchedules.orEmpty()
                .filter { it.media?.isAdult != true }
                .mapNotNull { it.toSlot() }
                .distinctBy { it.anime.id }
                .take(20),
            highestRated = d.top.anime(),
            upcoming = d.upcoming.anime(),
            hiddenGems = d.gems.anime(),
            communityFavorites = d.favourites.anime(),
            fetchedAt = fetchedAt,
            fromCache = fromCache,
        )
    }

    fun detail(id: Int, forceRefresh: Boolean = false): Flow<Loadable<AnimeDetail>> =
        cachedFlow("detail:$id", detailTtlMs, forceRefresh, MediaData.serializer(),
            fetch = { client.execute(AniListQueries.DETAIL, mapOf("id" to id), MediaData.serializer()) },
            map = { it.Media?.toDetail() },
        )

    suspend fun graph(id: Int): Outcome<AnimeDetail> = cachedOnce("graph:$id", MediaData.serializer(),
        { client.execute(AniListQueries.GRAPH, mapOf("id" to id), MediaData.serializer()) }) { it.Media?.toDetail() }

    suspend fun search(filters: SearchFilters, page: Int, perPage: Int = 24): Outcome<PageResult<Anime>> {
        val sort = if (filters.query.isNotBlank() && filters.sort == SearchSort.POPULARITY_DESC) listOf("SEARCH_MATCH", "POPULARITY_DESC")
        else listOf(filters.sort.apiValue)
        val vars = mapOf(
            "page" to page, "perPage" to perPage,
            "search" to filters.query.trim().takeIf { it.isNotEmpty() },
            "genres" to filters.genres.toList().takeIf { it.isNotEmpty() },
            "excludedGenres" to filters.excludedGenres.toList().takeIf { it.isNotEmpty() },
            "tags" to filters.tags.toList().takeIf { it.isNotEmpty() },
            "year" to filters.year, "season" to filters.season, "format" to filters.format, "status" to filters.status,
            "minScore" to filters.minScore, "sort" to sort,
        )
        val key = "search:" + vars.toString().hashCode() + ":" + page
        return cachedOnce(key, PageData.serializer(), { client.execute(AniListQueries.SEARCH, vars, PageData.serializer()) }, trimPrefix = "search:") { d ->
            val p = d.Page ?: return@cachedOnce null
            PageResult(p.media.orEmpty().filterNot { it.isAdult == true }.map { it.toAnime() }, p.pageInfo?.currentPage ?: page, p.pageInfo?.hasNextPage == true)
        }
    }

    suspend fun seasonal(season: AnimeSeason, year: Int, page: Int, sort: SearchSort = SearchSort.POPULARITY_DESC, format: String? = null) =
        search(SearchFilters(season = season.name, year = year, sort = sort, format = format), page, perPage = 30)

    suspend fun genresAndTags(): Outcome<Pair<List<String>, List<String>>> =
        cachedOnce("genres", GenreData.serializer(), { client.execute(AniListQueries.GENRES, emptyMap(), GenreData.serializer()) }) { d ->
            d.GenreCollection.orEmpty().filterNot { it == "Hentai" } to
                d.MediaTagCollection.orEmpty().filter { it.isAdult != true }.map { it.name }
        }

    suspend fun reviews(page: Int, mediaId: Int? = null): Outcome<PageResult<ReviewSummary>> =
        cachedOnce("reviews:${mediaId ?: "all"}:$page", PageData.serializer(),
            { client.execute(AniListQueries.REVIEWS, mapOf("page" to page, "mediaId" to mediaId), PageData.serializer()) }, trimPrefix = "reviews:") { d ->
            val p = d.Page ?: return@cachedOnce null
            PageResult(p.reviews.orEmpty().filter { it.media?.isAdult != true }.map { it.toSummary() }, p.pageInfo?.currentPage ?: page, p.pageInfo?.hasNextPage == true)
        }

    /** Real airing data for the given titles (used for new-episode notifications and the home rail). */
    suspend fun airingFor(ids: List<Int>, afterSec: Long, beforeSec: Long): Outcome<List<AiringSlot>> = outcomeOf {
        if (ids.isEmpty()) return@outcomeOf emptyList()
        client.execute(AniListQueries.AIRING_FOR, mapOf("ids" to ids.take(50), "after" to afterSec, "before" to beforeSec), PageData.serializer())
            .data.Page?.airingSchedules.orEmpty().mapNotNull { it.toSlot() }
    }

    suspend fun byIds(ids: List<Int>): Outcome<List<Anime>> = outcomeOf {
        if (ids.isEmpty()) return@outcomeOf emptyList()
        ids.chunked(50).flatMap { chunk ->
            client.execute(AniListQueries.BY_IDS, mapOf("ids" to chunk, "page" to 1), PageData.serializer()).data.Page?.media.orEmpty().map { it.toAnime() }
        }
    }

    // ------------------------------------------------------------------

    private fun <D, T> cachedFlow(
        key: String,
        ttlMs: Long,
        force: Boolean,
        serializer: KSerializer<D>,
        fetch: suspend () -> GraphQlResult<D>,
        map: (D) -> T?,
    ): Flow<Loadable<T>> = flow {
        val cached = cache.get(key)
        val cachedValue = cached?.let { runCatching { map(client.decode(it.json.toJson(), serializer)) }.getOrNull() }
        if (cachedValue != null) {
            val fresh = clock.nowMillis() - cached.fetchedAt < ttlMs
            emit(Loadable(cachedValue, loading = !fresh || force, stale = true))
            if (fresh && !force) return@flow
        } else emit(Loadable(loading = true))
        try {
            val result = fetch()
            val value = map(result.data)
            if (value == null) {
                emit(Loadable(cachedValue, error = KazeError.NotFound("That anime")))
            } else {
                cache.put(CachedQueryEntity(key, result.raw.toString(), clock.nowMillis()))
                emit(Loadable(value))
            }
        } catch (c: CancellationException) {
            throw c
        } catch (t: Throwable) {
            emit(Loadable(cachedValue, error = t.toKazeError(), stale = cachedValue != null))
        }
    }

    /** Network first; on failure fall back to the last cached copy (offline browsing). */
    private suspend fun <D, T> cachedOnce(
        key: String,
        serializer: KSerializer<D>,
        fetch: suspend () -> GraphQlResult<D>,
        trimPrefix: String? = null,
        map: (D) -> T?,
    ): Outcome<T> {
        return try {
            val result = fetch()
            val value = map(result.data) ?: return Outcome.Failure(KazeError.NotFound("That page"))
            cache.put(CachedQueryEntity(key, result.raw.toString(), clock.nowMillis()))
            if (trimPrefix != null) cache.trim(trimPrefix, 60)
            Outcome.Success(value)
        } catch (c: CancellationException) {
            throw c
        } catch (t: Throwable) {
            val fallback = cache.get(key)?.let { runCatching { map(client.decode(it.json.toJson(), serializer)) }.getOrNull() }
            if (fallback != null) Outcome.Success(fallback) else Outcome.Failure(t.toKazeError())
        }
    }

    private fun String.toJson() = kotlinx.serialization.json.Json.parseToJsonElement(this)
}
