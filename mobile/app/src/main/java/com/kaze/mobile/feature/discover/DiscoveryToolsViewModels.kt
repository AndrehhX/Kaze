package com.kaze.mobile.feature.discover

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.toRoute
import com.kaze.mobile.core.common.KazeError
import com.kaze.mobile.core.common.Outcome
import com.kaze.mobile.data.anilist.AniListRepository
import com.kaze.mobile.data.library.LibraryRepository
import com.kaze.mobile.domain.model.Anime
import com.kaze.mobile.domain.model.AnimeDetail
import com.kaze.mobile.domain.model.AnimeSeason
import com.kaze.mobile.domain.model.SearchFilters
import com.kaze.mobile.domain.model.SearchSort
import com.kaze.mobile.domain.recommendation.Mood
import com.kaze.mobile.domain.recommendation.Roulette
import com.kaze.mobile.navigation.SeasonalRoute
import com.kaze.mobile.navigation.SimilarityRoute
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import javax.inject.Inject

// ------------------------------- Seasonal -------------------------------

data class SeasonalState(
    val season: AnimeSeason,
    val year: Int,
    val format: String? = null,
    val sort: SearchSort = SearchSort.POPULARITY_DESC,
    val items: List<Anime> = emptyList(),
    val page: Int = 0,
    val hasMore: Boolean = false,
    val loading: Boolean = true,
    val error: KazeError? = null,
)

@HiltViewModel
class SeasonalViewModel @Inject constructor(savedState: SavedStateHandle, private val repo: AniListRepository) : ViewModel() {
    private val args = savedState.toRoute<SeasonalRoute>()
    private val today = LocalDate.now()
    private val current = AnimeSeason.current(today.monthValue, today.year)
    private val _state = MutableStateFlow(
        SeasonalState(
            season = args.season?.let { s -> AnimeSeason.entries.firstOrNull { it.name == s } } ?: current.first,
            year = args.year ?: current.second,
        )
    )
    val state = _state.asStateFlow()
    private var job: Job? = null

    init { load(reset = true) }

    fun previous() { val (s, y) = _state.value.season.previous(_state.value.year); _state.update { it.copy(season = s, year = y) }; load(true) }
    fun next() { val (s, y) = _state.value.season.next(_state.value.year); _state.update { it.copy(season = s, year = y) }; load(true) }
    fun select(season: AnimeSeason) { _state.update { it.copy(season = season) }; load(true) }
    fun setFormat(f: String?) { _state.update { it.copy(format = f) }; load(true) }
    fun setSort(s: SearchSort) { _state.update { it.copy(sort = s) }; load(true) }
    fun loadMore() { if (!_state.value.loading && _state.value.hasMore) load(false) }
    fun retry() = load(true)

    private fun load(reset: Boolean) {
        job?.cancel()
        job = viewModelScope.launch {
            val s = _state.value
            _state.update { it.copy(loading = true, error = null, items = if (reset) emptyList() else it.items) }
            when (val r = repo.seasonal(s.season, s.year, if (reset) 1 else s.page + 1, s.sort, s.format)) {
                is Outcome.Success -> _state.update { it.copy(items = (if (reset) r.value.items else it.items + r.value.items).distinctBy { a -> a.id }, page = r.value.page, hasMore = r.value.hasNextPage, loading = false) }
                is Outcome.Failure -> _state.update { it.copy(loading = false, error = r.error) }
            }
        }
    }
}

// ------------------------------- Mood -------------------------------

data class MoodState(val mood: Mood? = null, val items: List<Anime> = emptyList(), val loading: Boolean = false, val error: KazeError? = null, val relaxed: Boolean = false)

@HiltViewModel
class MoodViewModel @Inject constructor(private val repo: AniListRepository, library: LibraryRepository) : ViewModel() {
    private val _state = MutableStateFlow(MoodState())
    val state = _state.asStateFlow()
    private val owned = library.entries.map { l -> l.map { it.animeId }.toSet() }.stateIn(viewModelScope, SharingStarted.Eagerly, emptySet())
    private var job: Job? = null

    fun pick(mood: Mood) {
        job?.cancel()
        _state.value = MoodState(mood = mood, loading = true)
        job = viewModelScope.launch {
            var relaxed = false
            var r = repo.search(mood.toFilters(), 1, perPage = 30)
            if (r is Outcome.Success && r.value.items.size < 8 && mood.tags.isNotEmpty()) {
                relaxed = true
                r = repo.search(mood.toGenreOnlyFilters(), 1, perPage = 30)
            }
            _state.value = when (r) {
                is Outcome.Success -> MoodState(mood, r.value.items.sortedBy { it.id in owned.value }, relaxed = relaxed)
                is Outcome.Failure -> MoodState(mood, error = r.error)
            }
        }
    }
}

// ------------------------------- Roulette -------------------------------

data class RouletteState(
    val genres: Set<String> = emptySet(),
    val format: String? = null,
    val minScore: Int? = 70,
    val excludeOwned: Boolean = true,
    val pool: List<Anime> = emptyList(),
    val winnerIndex: Int? = null,
    val spinId: Int = 0,
    val loading: Boolean = false,
    val error: KazeError? = null,
)

@HiltViewModel
class RouletteViewModel @Inject constructor(private val repo: AniListRepository, library: LibraryRepository) : ViewModel() {
    private val roulette = Roulette()
    private val _state = MutableStateFlow(RouletteState())
    val state = _state.asStateFlow()
    private val owned = library.entries.map { l -> l.map { it.animeId }.toSet() }.stateIn(viewModelScope, SharingStarted.Eagerly, emptySet())

    fun toggleGenre(g: String) = _state.update { it.copy(genres = if (g in it.genres) it.genres - g else it.genres + g) }
    fun setFormat(f: String?) = _state.update { it.copy(format = f) }
    fun setMinScore(s: Int?) = _state.update { it.copy(minScore = s) }
    fun setExcludeOwned(v: Boolean) = _state.update { it.copy(excludeOwned = v) }

    /** Random page from the filtered catalogue, then a uniformly random winner from that page. */
    fun spin() = viewModelScope.launch {
        val s = _state.value
        _state.update { it.copy(loading = true, error = null, winnerIndex = null) }
        val filters = SearchFilters(genres = s.genres, format = s.format, minScore = s.minScore, sort = SearchSort.POPULARITY_DESC)
        var r = repo.search(filters, roulette.randomPage(10), perPage = 30)
        if (r is Outcome.Success && r.value.items.isEmpty()) r = repo.search(filters, 1, perPage = 30)
        when (r) {
            is Outcome.Success -> {
                val pool = r.value.items.filter { !s.excludeOwned || it.id !in owned.value }.ifEmpty { r.value.items }
                if (pool.isEmpty()) _state.update { it.copy(loading = false, pool = emptyList(), error = KazeError.Validation("Nothing matches those filters. Loosen them and spin again.")) }
                else {
                    val winner = roulette.pick(pool.indices.toList())!!
                    _state.update { it.copy(loading = false, pool = pool, winnerIndex = winner, spinId = it.spinId + 1) }
                }
            }
            is Outcome.Failure -> _state.update { it.copy(loading = false, error = r.error) }
        }
    }
}

// ------------------------------- Similarity -------------------------------

data class GraphNode(val anime: Anime, val kind: Kind, val label: String) { enum class Kind { CENTER, RELATION, RECOMMENDATION } }
data class SimilarityState(val center: AnimeDetail? = null, val nodes: List<GraphNode> = emptyList(), val trail: List<Anime> = emptyList(), val loading: Boolean = true, val error: KazeError? = null)

@HiltViewModel
class SimilarityViewModel @Inject constructor(savedState: SavedStateHandle, private val repo: AniListRepository) : ViewModel() {
    private val start = savedState.toRoute<SimilarityRoute>().id
    private val _state = MutableStateFlow(SimilarityState())
    val state = _state.asStateFlow()
    private var job: Job? = null

    init { focus(start, null) }

    fun focus(id: Int, from: Anime?) {
        job?.cancel()
        job = viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null, trail = if (from != null) (it.trail + from).takeLast(6) else it.trail) }
            when (val r = repo.graph(id)) {
                is Outcome.Success -> {
                    val d = r.value
                    // Keep the graph legible on a phone: at most 8 relations + 10 recommendations.
                    val rel = d.relations.distinctBy { it.anime.id }.take(8).map { GraphNode(it.anime, GraphNode.Kind.RELATION, it.label) }
                    val recs = d.recommendations.filter { r2 -> rel.none { it.anime.id == r2.anime.id } }.take(10)
                        .map { GraphNode(it.anime, GraphNode.Kind.RECOMMENDATION, "+${it.rating} votes") }
                    _state.update { it.copy(center = d, nodes = rel + recs, loading = false) }
                }
                is Outcome.Failure -> _state.update { it.copy(loading = false, error = r.error) }
            }
        }
    }

    fun back() {
        val prev = _state.value.trail.lastOrNull() ?: return
        _state.update { it.copy(trail = it.trail.dropLast(1)) }
        focus(prev.id, null)
    }
}
