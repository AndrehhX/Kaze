package com.kaze.mobile.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kaze.mobile.core.common.Loadable
import com.kaze.mobile.core.common.Outcome
import com.kaze.mobile.core.datastore.UserPreferencesRepository
import com.kaze.mobile.core.network.NetworkMonitor
import com.kaze.mobile.data.anilist.AniListRepository
import com.kaze.mobile.data.library.LibraryRepository
import com.kaze.mobile.data.library.ProgressRepository
import com.kaze.mobile.domain.model.Anime
import com.kaze.mobile.domain.model.HomeCatalog
import com.kaze.mobile.domain.model.LibraryEntry
import com.kaze.mobile.domain.model.LibraryStatus
import com.kaze.mobile.domain.model.SearchFilters
import com.kaze.mobile.domain.model.SearchSort
import com.kaze.mobile.domain.model.WatchProgress
import com.kaze.mobile.domain.recommendation.Recommended
import com.kaze.mobile.domain.recommendation.RecommendationEngine
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PersonalRail(val title: String, val subtitle: String?, val items: List<Anime>, val reasons: Map<Int, String>)

@OptIn(ExperimentalCoroutinesApi::class, kotlinx.coroutines.FlowPreview::class)
@HiltViewModel
class HomeViewModel @Inject constructor(
    private val anilist: AniListRepository,
    private val library: LibraryRepository,
    progress: ProgressRepository,
    prefsRepo: UserPreferencesRepository,
    network: NetworkMonitor,
) : ViewModel() {

    private val refresh = MutableStateFlow(0)

    val catalog: StateFlow<Loadable<HomeCatalog>> = refresh
        .flatMapLatest { n -> anilist.home(forceRefresh = n > 0) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), Loadable(loading = true))

    val continueWatching: StateFlow<List<WatchProgress>> = progress.continueWatching
        .map { list -> list.filterNot { it.completed && it.fraction > 0.98f } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val libraryIds: StateFlow<Map<Int, LibraryEntry>> = library.entries
        .map { l -> l.associateBy { it.animeId } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyMap())

    val isOnline = network.isOnline.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), true)

    /** "Recommended for you": explainable scoring over every candidate the home payload contains. */
    val recommended: StateFlow<List<Recommended>?> = combine(catalog, library.entries, prefsRepo.prefs) { cat, lib, prefs ->
        val data = cat.data ?: return@combine null
        val profile = RecommendationEngine.profile(lib, prefs.favoriteGenres)
        if (profile.isEmpty) return@combine emptyList()
        val candidates = data.trending + data.popularSeason + data.highestRated + data.hiddenGems + data.communityFavorites
        RecommendationEngine.rank(profile, candidates, excludeIds = lib.map { it.animeId }.toSet(), limit = 15)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    private val _favoriteGenre = MutableStateFlow<PersonalRail?>(null)
    val favoriteGenre = _favoriteGenre.asStateFlow()

    private val _becauseYouLiked = MutableStateFlow<PersonalRail?>(null)
    val becauseYouLiked = _becauseYouLiked.asStateFlow()

    init {
        // Personal rails only re-query AniList when the user's taste actually changes.
        viewModelScope.launch {
            combine(library.entries, prefsRepo.prefs) { lib, prefs -> RecommendationEngine.profile(lib, prefs.favoriteGenres) to lib }
                .map { (profile, lib) -> Triple(profile.topGenres.firstOrNull(), profile.seedTitles.firstOrNull(), lib.map { it.animeId }.toSet()) }
                .distinctUntilChanged { a, b -> a.first == b.first && a.second?.animeId == b.second?.animeId }
                .debounce(300)
                .collect { (genre, seed, owned) -> loadPersonal(genre, seed, owned) }
        }
        // Retry automatically when connectivity returns.
        viewModelScope.launch {
            network.isOnline.drop(1).filter { it }.collect { if (catalog.value.error != null) refresh() }
        }
    }

    private suspend fun loadPersonal(genre: String?, seed: LibraryEntry?, owned: Set<Int>) {
        if (genre != null) {
            val r = anilist.search(SearchFilters(genres = setOf(genre), sort = SearchSort.SCORE_DESC), page = 1, perPage = 20)
            if (r is Outcome.Success) _favoriteGenre.value = PersonalRail(
                "Because you love $genre", "Top-rated $genre on AniList",
                r.value.items.filterNot { it.id in owned }, emptyMap(),
            )
        } else _favoriteGenre.value = null
        if (seed != null) {
            val r = anilist.graph(seed.animeId)
            if (r is Outcome.Success) _becauseYouLiked.value = PersonalRail(
                "Because you liked ${seed.title}", "Recommended by AniList users who also loved it",
                r.value.recommendations.map { it.anime }.filterNot { it.id in owned },
                emptyMap(),
            )
        } else _becauseYouLiked.value = null
    }

    fun refresh() { refresh.value += 1 }

    fun toggleInList(anime: Anime) = viewModelScope.launch {
        if (libraryIds.value.containsKey(anime.id)) library.remove(listOf(anime.id))
        else library.addOrUpdate(anime, LibraryStatus.PLANNING)
    }
}
