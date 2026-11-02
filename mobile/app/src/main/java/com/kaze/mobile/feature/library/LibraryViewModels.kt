package com.kaze.mobile.feature.library

import android.content.Context
import android.net.Uri
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.toRoute
import com.kaze.mobile.data.library.CollectionsRepository
import com.kaze.mobile.data.library.LibraryRepository
import com.kaze.mobile.data.library.ProgressRepository
import com.kaze.mobile.domain.model.AnimeCollection
import com.kaze.mobile.domain.model.LibraryEntry
import com.kaze.mobile.domain.model.LibraryFilter
import com.kaze.mobile.domain.model.LibrarySort
import com.kaze.mobile.domain.model.LibraryStatus
import com.kaze.mobile.domain.model.WatchProgress
import com.kaze.mobile.domain.model.applyFilter
import com.kaze.mobile.domain.recommendation.AnimeDna
import com.kaze.mobile.domain.recommendation.AnimeDnaCalculator
import com.kaze.mobile.navigation.CollectionRoute
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

data class LibraryUi(
    val all: List<LibraryEntry> = emptyList(),
    val visible: List<LibraryEntry> = emptyList(),
    val counts: Map<LibraryStatus?, Int> = emptyMap(),
    val favorites: Int = 0,
    val genres: List<String> = emptyList(),
    val loaded: Boolean = false,
)

@HiltViewModel
class LibraryViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val repo: LibraryRepository,
    private val collectionsRepo: CollectionsRepository,
) : ViewModel() {

    private val _filter = MutableStateFlow(LibraryFilter())
    val filter = _filter.asStateFlow()
    private val _selection = MutableStateFlow<Set<Int>>(emptySet())
    val selection = _selection.asStateFlow()
    private val _messages = Channel<String>(Channel.BUFFERED)
    val messages = _messages.receiveAsFlow()

    val ui: StateFlow<LibraryUi> = combine(repo.entries, _filter) { all, f ->
        LibraryUi(
            all = all,
            visible = all.applyFilter(f),
            counts = (listOf<LibraryStatus?>(null) + LibraryStatus.entries).associateWith { s -> if (s == null) all.size else all.count { it.status == s } },
            favorites = all.count { it.isFavorite },
            genres = all.flatMap { it.genres }.groupingBy { it }.eachCount().entries.sortedByDescending { it.value }.map { it.key }.take(12),
            loaded = true,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), LibraryUi())

    val collections: StateFlow<List<AnimeCollection>> = collectionsRepo.collections.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun setStatus(s: LibraryStatus?) = _filter.update { it.copy(status = s, favoritesOnly = false) }
    fun showFavorites() = _filter.update { it.copy(status = null, favoritesOnly = true) }
    fun setSort(s: LibrarySort) = _filter.update { it.copy(sort = s) }
    fun setGenre(g: String?) = _filter.update { it.copy(genre = g) }
    fun setQuery(q: String) = _filter.update { it.copy(query = q.take(60)) }

    fun toggleSelect(id: Int) = _selection.update { if (id in it) it - id else it + id }
    fun selectAllVisible() = _selection.update { ui.value.visible.map { e -> e.animeId }.toSet() }
    fun clearSelection() = _selection.update { emptySet() }

    fun bulkStatus(s: LibraryStatus) = viewModelScope.launch {
        val ids = _selection.value
        repo.bulkSetStatus(ids, s)
        _selection.value = emptySet()
        _messages.send("Moved ${ids.size} to ${s.label}")
    }

    fun bulkRemove() = viewModelScope.launch {
        val ids = _selection.value
        repo.remove(ids)
        _selection.value = emptySet()
        _messages.send("Removed ${ids.size} from your library")
    }

    fun bulkAddToCollection(collectionId: Long) = viewModelScope.launch {
        val entries = ui.value.all.filter { it.animeId in _selection.value }
        entries.forEach { collectionsRepo.addEntry(collectionId, it) }
        _selection.value = emptySet()
        _messages.send("Added ${entries.size} to collection")
    }

    fun incrementProgress(e: LibraryEntry) = viewModelScope.launch { repo.setProgress(e.animeId, e.progress + 1) }

    fun moveCustom(id: Int, delta: Int) = viewModelScope.launch {
        val list = ui.value.visible.map { it.animeId }.toMutableList()
        val i = list.indexOf(id)
        val j = i + delta
        if (i < 0 || j !in list.indices) return@launch
        list.add(j, list.removeAt(i))
        repo.reorder(list)
    }

    fun export(uri: Uri) = viewModelScope.launch {
        runCatching {
            val text = repo.exportJson()
            withContext(Dispatchers.IO) { context.contentResolver.openOutputStream(uri)?.use { it.write(text.toByteArray()) } ?: error("Can't write file") }
        }.onSuccess { _messages.send("Library exported") }.onFailure { _messages.send("Export failed: ${it.message}") }
    }

    fun import(uri: Uri) = viewModelScope.launch {
        runCatching {
            val text = withContext(Dispatchers.IO) {
                context.contentResolver.openInputStream(uri)?.use { s -> s.readBytes().also { require(it.size < 10_000_000) { "File too large" } }.decodeToString() } ?: error("Can't read file")
            }
            repo.importJson(text)
        }.onSuccess { r -> _messages.send("Imported: ${r.added} new, ${r.updated} updated, ${r.skippedOlder} kept (local was newer)") }
            .onFailure { _messages.send("Import failed: ${it.message}") }
    }
}

@HiltViewModel
class CollectionsViewModel @Inject constructor(private val repo: CollectionsRepository) : ViewModel() {
    val collections = repo.collections.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
    private val _error = MutableStateFlow<String?>(null)
    val error = _error.asStateFlow()

    fun create(name: String, description: String, public: Boolean) = viewModelScope.launch {
        runCatching { repo.create(name, description, public) }.onFailure { _error.value = it.message }.onSuccess { _error.value = null }
    }
    fun delete(id: Long) = viewModelScope.launch { repo.delete(id) }
    fun move(id: Long, delta: Int) = viewModelScope.launch {
        val ids = collections.value.orEmpty().map { it.id }.toMutableList()
        val i = ids.indexOf(id); val j = i + delta
        if (i < 0 || j !in ids.indices) return@launch
        ids.add(j, ids.removeAt(i))
        repo.reorderCollections(ids)
    }
}

@HiltViewModel
class CollectionDetailViewModel @Inject constructor(
    savedState: SavedStateHandle,
    private val repo: CollectionsRepository,
    library: LibraryRepository,
) : ViewModel() {
    val id = savedState.toRoute<CollectionRoute>().id
    val collection = repo.collection(id).stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
    val library = library.entries.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun update(name: String, description: String, public: Boolean) = viewModelScope.launch { repo.update(id, name, description, public) }
    fun remove(animeId: Int) = viewModelScope.launch { repo.remove(id, animeId) }
    fun add(entry: LibraryEntry) = viewModelScope.launch { repo.addEntry(id, entry) }
    fun move(animeId: Int, delta: Int) = viewModelScope.launch {
        val ids = collection.value?.items?.map { it.animeId }?.toMutableList() ?: return@launch
        val i = ids.indexOf(animeId); val j = i + delta
        if (i < 0 || j !in ids.indices) return@launch
        ids.add(j, ids.removeAt(i))
        repo.reorderItems(id, ids)
    }
}

@HiltViewModel
class DnaViewModel @Inject constructor(library: LibraryRepository, progress: ProgressRepository) : ViewModel() {
    val dna: StateFlow<AnimeDna?> = library.entries.map { AnimeDnaCalculator.compute(it) }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
    val demoWatchMs = progress.totalWatchMs.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0L)
}

@HiltViewModel
class HistoryViewModel @Inject constructor(private val progress: ProgressRepository) : ViewModel() {
    val history: StateFlow<List<WatchProgress>?> = progress.history.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
    fun clear(animeId: Int) = viewModelScope.launch { progress.clear(animeId) }
}
