package com.kaze.mobile.feature.detail

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.toRoute
import com.kaze.mobile.core.common.Loadable
import com.kaze.mobile.data.anilist.AniListRepository
import com.kaze.mobile.data.library.CollectionsRepository
import com.kaze.mobile.data.library.LibraryRepository
import com.kaze.mobile.data.library.ProgressRepository
import com.kaze.mobile.domain.model.Anime
import com.kaze.mobile.domain.model.AnimeCollection
import com.kaze.mobile.domain.model.AnimeDetail
import com.kaze.mobile.domain.model.LibraryEntry
import com.kaze.mobile.domain.model.LibraryStatus
import com.kaze.mobile.domain.model.WatchProgress
import com.kaze.mobile.navigation.AnimeRoute
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface DetailEvent {
    data class Completed(val title: String) : DetailEvent
    data class Message(val text: String) : DetailEvent
}

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class DetailViewModel @Inject constructor(
    savedState: SavedStateHandle,
    private val anilist: AniListRepository,
    private val library: LibraryRepository,
    private val collectionsRepo: CollectionsRepository,
    progressRepo: ProgressRepository,
) : ViewModel() {

    val route = savedState.toRoute<AnimeRoute>()
    val id = route.id
    private val refresh = MutableStateFlow(0)

    val detail: StateFlow<Loadable<AnimeDetail>> = refresh
        .flatMapLatest { anilist.detail(id, forceRefresh = it > 0) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), Loadable(loading = true))

    val entry: StateFlow<LibraryEntry?> = library.entry(id).stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
    val progress: StateFlow<List<WatchProgress>> = progressRepo.forAnime(id).stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val collections: StateFlow<List<AnimeCollection>> = collectionsRepo.collections.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val inCollections: StateFlow<List<Long>> = collectionsRepo.collectionsContaining(id).stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val _events = Channel<DetailEvent>(Channel.BUFFERED)
    val events = _events.receiveAsFlow()

    fun retry() { refresh.value += 1 }

    private fun anime(): Anime? = detail.value.data?.anime

    fun setStatus(status: LibraryStatus) = viewModelScope.launch {
        val a = anime() ?: return@launch
        val wasCompleted = entry.value?.status == LibraryStatus.COMPLETED
        library.addOrUpdate(a, status)
        if (status == LibraryStatus.COMPLETED && !wasCompleted) _events.send(DetailEvent.Completed(a.displayTitle))
    }

    fun setProgress(p: Int) = viewModelScope.launch {
        val a = anime() ?: return@launch
        if (entry.value == null) library.addOrUpdate(a, LibraryStatus.WATCHING)
        if (library.setProgress(id, p)) _events.send(DetailEvent.Completed(a.displayTitle))
    }

    fun setScore(score: Int?) = viewModelScope.launch {
        val a = anime() ?: return@launch
        if (entry.value == null) library.addOrUpdate(a, LibraryStatus.COMPLETED)
        library.setScore(id, score)
    }

    fun toggleFavorite() = viewModelScope.launch { anime()?.let { library.toggleFavorite(it) } }

    fun remove() = viewModelScope.launch {
        library.remove(listOf(id))
        _events.send(DetailEvent.Message("Removed from your library"))
    }

    fun toggleCollection(collectionId: Long) = viewModelScope.launch {
        val a = anime() ?: return@launch
        if (collectionId in inCollections.value) collectionsRepo.remove(collectionId, id) else collectionsRepo.add(collectionId, a)
    }

    fun createCollection(name: String) = viewModelScope.launch {
        val a = anime() ?: return@launch
        runCatching { collectionsRepo.create(name, "", isPublic = false) }
            .onSuccess { collectionsRepo.add(it, a); _events.send(DetailEvent.Message("Added to “$name”")) }
            .onFailure { _events.send(DetailEvent.Message(it.message ?: "Couldn't create collection")) }
    }
}
