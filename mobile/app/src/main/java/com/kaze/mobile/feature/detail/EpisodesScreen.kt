package com.kaze.mobile.feature.detail

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.navigation.toRoute
import com.kaze.mobile.core.common.Loadable
import com.kaze.mobile.core.designsystem.components.EmptyState
import com.kaze.mobile.core.designsystem.components.ErrorState
import com.kaze.mobile.core.designsystem.components.KazeSpinner
import com.kaze.mobile.core.designsystem.components.KazeTopBar
import com.kaze.mobile.data.anilist.AniListRepository
import com.kaze.mobile.data.library.LibraryRepository
import com.kaze.mobile.data.library.ProgressRepository
import com.kaze.mobile.data.playback.DownloadRepository
import com.kaze.mobile.domain.model.AnimeDetail
import com.kaze.mobile.domain.model.LibraryEntry
import com.kaze.mobile.domain.model.WatchProgress
import com.kaze.mobile.feature.player.PlaybackRequest
import com.kaze.mobile.feature.player.PlayerLauncher
import com.kaze.mobile.navigation.EpisodesRoute
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class EpisodesViewModel @Inject constructor(
    savedState: SavedStateHandle,
    anilist: AniListRepository,
    library: LibraryRepository,
    progressRepo: ProgressRepository,
    val downloadRepo: DownloadRepository,
    private val marks: EpisodeMarks,
) : ViewModel() {
    val id = savedState.toRoute<EpisodesRoute>().id
    val detail: StateFlow<Loadable<AnimeDetail>> = anilist.detail(id).stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), Loadable(loading = true))
    val entry: StateFlow<LibraryEntry?> = library.entry(id).stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
    val progress: StateFlow<List<WatchProgress>> = progressRepo.forAnime(id).stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val downloads = downloadRepo.downloads

    fun downloadEpisode(ep: Int) = viewModelScope.launch {
        val a = detail.value.data?.anime ?: return@launch
        downloadRepo.startDownload(animeId = id, episode = ep, animeTitle = a.displayTitle, coverUrl = a.coverUrl, audio = "sub")
    }

    fun markWatched(ep: Int) = viewModelScope.launch {
        val a = detail.value.data?.anime ?: return@launch
        marks.markWatched(a, ep, progress.value, entry.value)
    }

    fun markUnwatched(ep: Int) = viewModelScope.launch {
        val a = detail.value.data?.anime ?: return@launch
        marks.markUnwatched(a, ep, entry.value)
    }
}

/** Lista completa de episodios (la misma que la pestaña "Episodios" de la ficha). */
@Composable
fun EpisodesScreen(onBack: () -> Unit, vm: EpisodesViewModel = hiltViewModel()) {
    val state by vm.detail.collectAsStateWithLifecycle()
    val entry by vm.entry.collectAsStateWithLifecycle()
    val progress by vm.progress.collectAsStateWithLifecycle()
    val downloads by vm.downloads.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val d = state.data
    Column(Modifier.fillMaxSize()) {
        KazeTopBar("Episodios", onBack, subtitle = d?.anime?.displayTitle)
        when {
            d == null && state.error != null -> ErrorState(state.error!!.userMessage)
            d == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { KazeSpinner() }
            (d.availableEpisodes() ?: 0) <= 0 -> EmptyState("Episodios no anunciados", "Aún no se ha publicado ningún episodio de ${d.anime.displayTitle}.")
            else -> {
                val a = d.anime
                val dl = downloads.filter { it.animeId == a.id }.associate { it.episode to it.status }
                LazyColumn(contentPadding = PaddingValues(top = 4.dp, bottom = 120.dp)) {
                    episodeItems(
                        d, entry, progress, dl,
                        onPlay = { ep -> PlayerLauncher.launch(context, PlaybackRequest(a.id, ep, a.displayTitle, a.coverUrl, a.bannerUrl, a.episodes)) },
                        onDownload = vm::downloadEpisode,
                        onMarkWatched = vm::markWatched,
                        onMarkUnwatched = vm::markUnwatched,
                    )
                }
            }
        }
    }
}
