package com.kaze.mobile.feature.detail

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.DownloadDone
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Downloading
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Replay
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.kaze.mobile.core.designsystem.components.AnimeImage
import com.kaze.mobile.core.designsystem.components.KazeIconButton
import com.kaze.mobile.core.designsystem.components.parseHexColor
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.data.library.LibraryRepository
import com.kaze.mobile.data.library.ProgressRepository
import com.kaze.mobile.data.playback.DownloadStatus
import com.kaze.mobile.domain.model.Anime
import com.kaze.mobile.domain.model.AnimeDetail
import com.kaze.mobile.domain.model.LibraryEntry
import com.kaze.mobile.domain.model.LibraryStatus
import com.kaze.mobile.domain.model.StreamingEpisode
import com.kaze.mobile.domain.model.WatchProgress
import javax.inject.Inject
import javax.inject.Singleton

/** Marcar episodios como vistos / no vistos (lo comparten la ficha y la lista de episodios). */
@Singleton
class EpisodeMarks @Inject constructor(
    private val library: LibraryRepository,
    private val progressRepo: ProgressRepository,
) {
    /** Marca este episodio y, como "hasta aquí", vuelve a contar los anteriores que desmarcaste a mano. */
    suspend fun markWatched(a: Anime, ep: Int, progress: List<WatchProgress>, entry: LibraryEntry?) {
        progressRepo.setEpisodeWatched(a.id, ep, a.displayTitle, a.coverUrl, a.bannerUrl, watched = true)
        progress.filter { it.episode < ep && !it.completed && it.positionMs == 0L }
            .forEach { progressRepo.setEpisodeWatched(a.id, it.episode, a.displayTitle, a.coverUrl, a.bannerUrl, watched = true) }
        if (entry == null) library.addOrUpdate(a, LibraryStatus.WATCHING)
        if ((entry?.progress ?: 0) < ep) library.setProgress(a.id, ep)
    }

    suspend fun markUnwatched(a: Anime, ep: Int, entry: LibraryEntry?) {
        progressRepo.setEpisodeWatched(a.id, ep, a.displayTitle, a.coverUrl, a.bannerUrl, watched = false)
        // El progreso de la serie solo baja si desmarcas el último visto.
        if ((entry?.progress ?: 0) == ep) library.setProgress(a.id, ep - 1)
    }
}

/** Episodios que ya se pueden ver: los anunciados, o hasta el último emitido si la serie sigue en emisión. */
fun AnimeDetail.availableEpisodes(): Int? {
    val a = anime
    return a.nextEpisode?.minus(1) ?: a.episodes
}

/**
 * Títulos y miniaturas oficiales de AniList. Algunas fichas traen la lista de otra serie
 * (AniList mezcla datos): esas se descartan para no mostrar títulos equivocados.
 */
fun AnimeDetail.officialEpisodes(): Map<Int, StreamingEpisode> {
    val first = streamingEpisodes.firstOrNull()?.title?.lowercase().orEmpty()
    val contaminated = listOf(
        "ryomen sukuna", "cruelty", "to you, 2,000 years", "operation strix",
        "i will make you invite", "battle without a quirk", "the result of the battle",
    ).any { it in first }
    if (contaminated) return emptyMap()
    return streamingEpisodes.mapNotNull { e -> e.number?.let { it to e } }.toMap()
}

/** "Episode 3 - El despertar" → "El despertar". */
private fun cleanTitle(raw: String?): String? =
    raw?.replace(Regex("(?i)^\\s*episode\\s*\\d+\\s*[-–:]\\s*"), "")?.trim()?.takeIf { it.isNotEmpty() && !it.matches(Regex("(?i)episode\\s*\\d+")) }

data class EpisodeRowState(
    val episode: Int,
    val title: String?,
    val thumbnail: String?,
    val progress: WatchProgress?,
    val watched: Boolean,
    val download: DownloadStatus?,
)

/** Una fila por episodio, al estilo Crunchyroll. */
fun LazyListScope.episodeItems(
    d: AnimeDetail,
    entry: LibraryEntry?,
    progress: List<WatchProgress>,
    downloads: Map<Int, DownloadStatus>,
    onPlay: (Int) -> Unit,
    onDownload: (Int) -> Unit,
    onMarkWatched: (Int) -> Unit,
    onMarkUnwatched: (Int) -> Unit,
) {
    val total = d.availableEpisodes() ?: 0
    val official = d.officialEpisodes()
    val byEpisode = progress.associateBy { it.episode }
    val a = d.anime
    items((1..total).toList(), key = { "ep-$it" }) { ep ->
        val p = byEpisode[ep]
        val off = official[ep]
        val state = EpisodeRowState(
            episode = ep,
            title = cleanTitle(off?.title),
            thumbnail = off?.thumbnail ?: a.bannerUrl ?: a.coverUrl,
            progress = p,
            watched = if (p != null) p.completed else (entry?.progress ?: 0) >= ep,
            download = downloads[ep],
        )
        EpisodeRow(state, a.color, a.duration, { onPlay(ep) }, { onDownload(ep) }, { onMarkWatched(ep) }, { onMarkUnwatched(ep) })
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun EpisodeRow(
    s: EpisodeRowState,
    color: String?,
    durationMin: Int?,
    onPlay: () -> Unit,
    onDownload: () -> Unit,
    onMarkWatched: () -> Unit,
    onMarkUnwatched: () -> Unit,
) {
    val c = Kaze.colors
    var menu by remember { mutableStateOf(false) }
    val p = s.progress
    val started = p != null && p.positionMs > 0 && !s.watched
    Row(
        Modifier.fillMaxWidth()
            .combinedClickable(
                role = Role.Button, onClickLabel = "Reproducir episodio ${s.episode}",
                onLongClickLabel = "Opciones del episodio ${s.episode}", onLongClick = { menu = true },
                onClick = onPlay,
            )
            .padding(horizontal = 16.dp, vertical = 6.dp),
    ) {
        Box(Modifier.width(150.dp).aspectRatio(16f / 9f).clip(RoundedCornerShape(6.dp)).background(c.surfaceHigh)) {
            AnimeImage(s.thumbnail, null, Modifier.fillMaxSize().alpha(if (s.watched) 0.5f else 1f), placeholderColor = parseHexColor(color))
            Box(Modifier.align(Alignment.Center).size(34.dp).clip(CircleShape).background(Color.Black.copy(alpha = 0.45f)), contentAlignment = Alignment.Center) {
                Icon(if (s.watched) Icons.Filled.Replay else Icons.Filled.PlayArrow, null, tint = Color.White, modifier = Modifier.size(20.dp))
            }
            val badge = when {
                s.watched -> "Visto"
                started -> "${((p!!.durationMs - p.positionMs).coerceAtLeast(0) / 60_000).coerceAtLeast(1)}m restantes"
                durationMin != null -> "${durationMin}m"
                else -> null
            }
            badge?.let {
                Text(
                    it, color = Color.White, style = Kaze.type.label,
                    modifier = Modifier.align(Alignment.BottomEnd).padding(5.dp).clip(RoundedCornerShape(3.dp))
                        .background(Color.Black.copy(alpha = 0.7f)).padding(horizontal = 5.dp, vertical = 1.dp),
                )
            }
            if (started) Box(Modifier.align(Alignment.BottomStart).fillMaxWidth().height(3.dp).background(Color.White.copy(alpha = 0.25f))) {
                Box(Modifier.fillMaxWidth(p!!.fraction.coerceIn(0.03f, 1f)).height(3.dp).background(c.primary))
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                "${s.episode}. ${s.title ?: "Episodio ${s.episode}"}",
                style = Kaze.type.body, color = if (s.watched) c.textMuted else c.text,
                maxLines = 2, overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.weight(1f))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
                KazeIconButton(
                    when (s.download) { DownloadStatus.COMPLETED -> Icons.Filled.DownloadDone; DownloadStatus.DOWNLOADING -> Icons.Filled.Downloading; else -> Icons.Filled.Download },
                    when (s.download) { DownloadStatus.COMPLETED -> "Episodio ${s.episode} descargado"; DownloadStatus.DOWNLOADING -> "Descargando episodio ${s.episode}"; else -> "Descargar episodio ${s.episode}" },
                    { if (s.download != DownloadStatus.COMPLETED && s.download != DownloadStatus.DOWNLOADING) onDownload() },
                    tint = if (s.download == DownloadStatus.COMPLETED) c.primary else c.textMuted,
                )
                Box {
                    KazeIconButton(Icons.Filled.MoreVert, "Opciones del episodio ${s.episode}", { menu = true }, tint = c.textMuted)
                    DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                        if (s.watched) DropdownMenuItem(
                            text = { Text("Marcar como no visto") },
                            leadingIcon = { Icon(Icons.Filled.RadioButtonUnchecked, null) },
                            onClick = { menu = false; onMarkUnwatched() },
                        ) else DropdownMenuItem(
                            text = { Text(if (s.episode > 1) "Marcar visto hasta aquí" else "Marcar como visto") },
                            leadingIcon = { Icon(Icons.Filled.CheckCircle, null) },
                            onClick = { menu = false; onMarkWatched() },
                        )
                    }
                }
            }
        }
    }
}
