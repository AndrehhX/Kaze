package com.kaze.mobile.feature.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.toRoute
import com.kaze.mobile.core.common.Loadable
import com.kaze.mobile.core.designsystem.components.AnimeImage
import com.kaze.mobile.core.designsystem.components.EmptyState
import com.kaze.mobile.core.designsystem.components.ErrorState
import com.kaze.mobile.core.designsystem.components.KazeCard
import com.kaze.mobile.core.designsystem.components.KazeChip
import com.kaze.mobile.core.designsystem.components.KazeIconButton
import com.kaze.mobile.core.designsystem.components.KazeSpinner
import com.kaze.mobile.core.designsystem.components.KazeTopBar
import com.kaze.mobile.core.designsystem.components.Pill
import com.kaze.mobile.core.designsystem.components.ProgressLine
import com.kaze.mobile.core.designsystem.components.parseHexColor
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.data.anilist.AniListRepository
import com.kaze.mobile.data.library.LibraryRepository
import com.kaze.mobile.data.library.ProgressRepository
import com.kaze.mobile.domain.model.AnimeDetail
import com.kaze.mobile.domain.model.LibraryEntry
import com.kaze.mobile.domain.model.LibraryStatus
import com.kaze.mobile.domain.model.WatchProgress
import com.kaze.mobile.feature.player.PlaybackRequest
import com.kaze.mobile.feature.player.PlayerLauncher
import com.kaze.mobile.feature.player.openExternalUrl
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
    private val library: LibraryRepository,
    progressRepo: ProgressRepository,
    val downloadRepo: com.kaze.mobile.data.playback.DownloadRepository,
) : ViewModel() {
    val id = savedState.toRoute<EpisodesRoute>().id
    val detail: StateFlow<Loadable<AnimeDetail>> = anilist.detail(id).stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), Loadable(loading = true))
    val entry: StateFlow<LibraryEntry?> = library.entry(id).stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
    val progress: StateFlow<List<WatchProgress>> = progressRepo.forAnime(id).stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val downloads = downloadRepo.downloads

    fun downloadEpisode(ep: Int) = viewModelScope.launch {
        val a = detail.value.data?.anime ?: return@launch
        downloadRepo.startDownload(
            animeId = id,
            episode = ep,
            animeTitle = a.displayTitle,
            coverUrl = a.coverUrl,
            audio = "sub"
        )
    }

    fun markWatchedThrough(ep: Int) = viewModelScope.launch {
        val a = detail.value.data?.anime ?: return@launch
        if (entry.value == null) library.addOrUpdate(a, LibraryStatus.WATCHING)
        library.setProgress(id, ep)
    }
}

/**
 * Episode list. Titles/thumbnails come only from AniList's official streaming listings when present.
 * KAZE's in-app player plays an authorized open-movie demo stream and says so on every row.
 */
@Composable
fun EpisodesScreen(onBack: () -> Unit, vm: EpisodesViewModel = hiltViewModel()) {
    val state by vm.detail.collectAsStateWithLifecycle()
    val entry by vm.entry.collectAsStateWithLifecycle()
    val progress by vm.progress.collectAsStateWithLifecycle()
    val downloads by vm.downloads.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val c = Kaze.colors
    val d = state.data
    Column(Modifier.fillMaxSize()) {
        KazeTopBar("Episodios", onBack, subtitle = d?.anime?.displayTitle)
        when {
            d == null && state.error != null -> ErrorState(state.error!!.userMessage)
            d == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { KazeSpinner() }
            else -> {
                val a = d.anime
                val known = a.episodes ?: a.nextEpisode?.minus(1)
                val firstEpTitle = d.streamingEpisodes.firstOrNull()?.title?.lowercase().orEmpty()
                val isContaminated = firstEpTitle.contains("ryomen sukuna") ||
                    firstEpTitle.contains("cruelty") ||
                    firstEpTitle.contains("to you, 2,000 years") ||
                    firstEpTitle.contains("operation strix") ||
                    firstEpTitle.contains("i will make you invite") ||
                    firstEpTitle.contains("battle without a quirk") ||
                    firstEpTitle.contains("the result of the battle")
                val official = if (isContaminated) emptyMap() else d.streamingEpisodes.associateBy { it.number }
                if (known == null || known <= 0) {
                    EmptyState("Episodios no anunciados", "Aún no se ha publicado la cantidad de episodios para ${a.displayTitle}.")
                    return@Column
                }
                val byEpisode = progress.associateBy { it.episode }
                LazyColumn(contentPadding = PaddingValues(bottom = 120.dp)) {
                    item {
                        KazeCard(Modifier.fillMaxWidth().padding(16.dp)) {
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text("Sobre la reproducción", style = Kaze.type.overline, color = c.accentText)
                                Text(
                                    "Reproducción oficial optimizada en streaming con servidores de alta velocidad, subtítulos y marcadores inteligentes AniSkip.",
                                    style = Kaze.type.bodySmall, color = c.text,
                                )
                                if (d.streamingLinks.isNotEmpty()) {
                                    androidx.compose.foundation.layout.FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                        d.streamingLinks.forEach { l -> KazeChip(l.site, icon = Icons.AutoMirrored.Filled.OpenInNew, onClick = { context.openExternalUrl(l.url) }) }
                                    }
                                }
                            }
                        }
                    }
                    val animeDownloads = downloads.filter { it.animeId == a.id }.associateBy { it.episode }
                    items((1..known).toList(), key = { it }) { ep ->
                        val p = byEpisode[ep]
                        val watched = (entry?.progress ?: 0) >= ep
                        val off = official[ep]
                        val dl = animeDownloads[ep]
                        val isDownloaded = dl?.status == com.kaze.mobile.data.playback.DownloadStatus.COMPLETED
                        val isDownloading = dl?.status == com.kaze.mobile.data.playback.DownloadStatus.DOWNLOADING
                        Row(
                            Modifier.fillMaxWidth()
                                .clickable(role = Role.Button, onClickLabel = "Reproducir episodio $ep") {
                                    PlayerLauncher.launch(context, PlaybackRequest(a.id, ep, a.displayTitle, a.coverUrl, a.bannerUrl, a.episodes))
                                }
                                .padding(horizontal = 16.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(Modifier.width(132.dp).aspectRatio(16f / 9f).clip(Kaze.style.cardShape).background(c.surfaceHigh)) {
                                AnimeImage(off?.thumbnail ?: a.bannerUrl ?: a.coverUrl, null, Modifier.fillMaxSize(), placeholderColor = parseHexColor(a.color))
                                Pill("EP $ep", Modifier.align(Alignment.TopStart).padding(4.dp), overImage = true)
                                p?.let { ProgressLine(it.fraction, Modifier.align(Alignment.BottomCenter)) }
                            }
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Text(off?.title ?: "Episodio $ep", style = Kaze.type.titleSmall, color = c.text, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                Text(
                                    when {
                                        p?.completed == true -> "Episodio visto"
                                        p != null -> "Episodio · ${(p.fraction * 100).toInt()}% visto"
                                        else -> "Disponible"
                                    },
                                    style = Kaze.type.bodySmall, color = c.textMuted,
                                )
                                if (off != null) Text(
                                    "Official: ${off.site}", style = Kaze.type.bodySmall, color = c.primary,
                                    modifier = Modifier.clickable(role = Role.Button, onClickLabel = "Open on ${off.site}") { context.openExternalUrl(off.url) },
                                )
                            }
                            KazeIconButton(
                                icon = Icons.Filled.Download,
                                contentDescription = when {
                                    isDownloaded -> "Episodio $ep descargado"
                                    isDownloading -> "Descargando episodio $ep"
                                    else -> "Descargar episodio $ep"
                                },
                                onClick = {
                                    if (!isDownloaded && !isDownloading) {
                                        vm.downloadEpisode(ep)
                                    }
                                },
                                tint = when {
                                    isDownloaded -> c.primary
                                    isDownloading -> c.accentText
                                    else -> c.textMuted
                                }
                            )
                            KazeIconButton(
                                if (watched) Icons.Filled.CheckCircle else Icons.Filled.RadioButtonUnchecked,
                                if (watched) "Episodio $ep visto. Ajustar progreso al episodio ${ep - 1}" else "Marcar como visto hasta el episodio $ep",
                                { vm.markWatchedThrough(if (watched) ep - 1 else ep) },
                                tint = if (watched) c.success else c.textMuted,
                            )
                        }
                    }
                    val sequel = d.relations.firstOrNull { it.type.equals("SEQUEL", ignoreCase = true) }?.anime
                    if (sequel != null) {
                        item {
                            KazeCard(
                                Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp)
                                    .clickable(role = Role.Button, onClickLabel = "Ver siguiente temporada") {
                                        PlayerLauncher.launch(context, PlaybackRequest(sequel.id, 1, sequel.displayTitle, sequel.coverUrl, sequel.bannerUrl, sequel.episodes))
                                    }
                            ) {
                                Row(
                                    Modifier.fillMaxWidth().padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Box(Modifier.width(68.dp).aspectRatio(16f / 9f).clip(Kaze.style.cardShape).background(c.surfaceHigh)) {
                                        AnimeImage(sequel.coverUrl ?: sequel.bannerUrl, null, Modifier.fillMaxSize(), placeholderColor = parseHexColor(sequel.color))
                                    }
                                    Spacer(Modifier.width(12.dp))
                                    Column(Modifier.weight(1f)) {
                                        Text("Siguiente Temporada", style = Kaze.type.overline, color = c.accentText)
                                        Text(sequel.displayTitle, style = Kaze.type.titleSmall, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                        Text("Comenzar Episodio 1 →", style = Kaze.type.bodySmall, color = c.primary)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
