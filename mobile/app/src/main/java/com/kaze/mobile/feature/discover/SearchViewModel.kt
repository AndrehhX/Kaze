package com.kaze.mobile.feature.discover

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.toRoute
import com.kaze.mobile.core.common.KazeError
import com.kaze.mobile.core.common.Outcome
import com.kaze.mobile.core.datastore.UserPreferencesRepository
import com.kaze.mobile.data.anilist.AniListRepository
import com.kaze.mobile.domain.model.AniListCatalog
import com.kaze.mobile.domain.model.Anime
import com.kaze.mobile.domain.model.SearchFilters
import com.kaze.mobile.navigation.SearchRoute
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SearchUiState(
    val filters: SearchFilters = SearchFilters(),
    val results: List<Anime> = emptyList(),
    val page: Int = 0,
    val hasMore: Boolean = false,
    val loading: Boolean = false,
    val error: KazeError? = null,
    val searched: Boolean = false,
)

@OptIn(FlowPreview::class)
@HiltViewModel
class SearchViewModel @Inject constructor(
    savedState: SavedStateHandle,
    private val repo: AniListRepository,
    private val prefs: UserPreferencesRepository,
) : ViewModel() {

    private val args = savedState.toRoute<SearchRoute>()
    private val _state = MutableStateFlow(
        SearchUiState(
            filters = SearchFilters(
                query = args.query,
                genres = setOfNotNull(args.genre),
                tags = setOfNotNull(args.tag),
            )
        )
    )
    val state: StateFlow<SearchUiState> = _state.asStateFlow()

    val savedSearches = prefs.prefs.map { it.savedSearches }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val _genres = MutableStateFlow(AniListCatalog.genres)
    val genres = _genres.asStateFlow()
    private val _tags = MutableStateFlow<List<String>>(emptyList())
    val tags = _tags.asStateFlow()

    private var job: Job? = null

    init {
        viewModelScope.launch {
            (repo.genresAndTags() as? Outcome.Success)?.value?.let { (g, t) -> _genres.value = g; _tags.value = t }
        }
        viewModelScope.launch {
            _state.map { it.filters }.distinctUntilChanged().debounce(350).collect { f ->
                if (f.isEmpty) _state.update { it.copy(results = emptyList(), searched = false, error = null, loading = false) }
                else load(reset = true)
            }
        }
    }

    fun setQuery(q: String) = _state.update { it.copy(filters = it.filters.copy(query = q.take(100))) }
    fun setFilters(f: SearchFilters) = _state.update { it.copy(filters = f) }
    fun clearFilters() = _state.update { it.copy(filters = SearchFilters(query = it.filters.query)) }

    fun submit() {
        val q = _state.value.filters.query
        if (q.isNotBlank()) viewModelScope.launch { prefs.addSavedSearch(q) }
        load(reset = true)
    }

    fun clearHistory() = viewModelScope.launch { prefs.clearSavedSearches() }

    fun loadMore() {
        val s = _state.value
        if (s.loading || !s.hasMore) return
        load(reset = false)
    }

    private fun load(reset: Boolean) {
        job?.cancel()
        job = viewModelScope.launch {
            val current = _state.value
            val page = if (reset) 1 else current.page + 1
            _state.update { it.copy(loading = true, error = null) }
            when (val r = repo.search(current.filters, page)) {
                is Outcome.Success -> _state.update {
                    it.copy(
                        results = if (reset) r.value.items else (it.results + r.value.items).distinctBy { a -> a.id },
                        page = r.value.page, hasMore = r.value.hasNextPage, loading = false, searched = true,
                    )
                }
                is Outcome.Failure -> _state.update { it.copy(loading = false, error = r.error, searched = true) }
            }
        }
    }
}
