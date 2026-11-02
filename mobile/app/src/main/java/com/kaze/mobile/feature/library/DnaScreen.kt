package com.kaze.mobile.feature.library

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Biotech
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.History
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.kaze.mobile.core.designsystem.components.AnimeImage
import com.kaze.mobile.core.designsystem.components.EmptyState
import com.kaze.mobile.core.designsystem.components.KazeCard
import com.kaze.mobile.core.designsystem.components.KazeIconButton
import com.kaze.mobile.core.designsystem.components.KazeSpinner
import com.kaze.mobile.core.designsystem.components.KazeTopBar
import com.kaze.mobile.core.designsystem.components.ProgressLine
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.domain.model.LibraryStatus
import com.kaze.mobile.domain.recommendation.AnimeDna
import java.text.DateFormat
import java.util.Date

@Composable
fun DnaScreen(onBack: () -> Unit, onBrowse: () -> Unit, vm: DnaViewModel = hiltViewModel()) {
    val dna by vm.dna.collectAsStateWithLifecycle()
    val demoMs by vm.demoWatchMs.collectAsStateWithLifecycle()
    Column(Modifier.fillMaxSize()) {
        KazeTopBar("Anime DNA", onBack, subtitle = "Computed from your library on this device")
        val d = dna
        when {
            d == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { KazeSpinner() }
            d.totalTitles == 0 -> EmptyState("No DNA yet", "Your DNA is built only from titles you add, rate and complete. Add a few to see it.", icon = Icons.Filled.Biotech, action = "Find anime", onAction = onBrowse)
            else -> DnaContent(d, demoMs)
        }
    }
}

@Composable
fun DnaContent(d: AnimeDna, demoWatchMs: Long, modifier: Modifier = Modifier) {
    val c = Kaze.colors
    val palette = listOf(c.primary, c.accent, c.secondary, c.success, c.warning, c.primary.copy(alpha = 0.6f), c.accent.copy(alpha = 0.6f), c.secondary.copy(alpha = 0.6f))
    LazyColumn(modifier, contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 120.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            KazeCard(Modifier.fillMaxWidth(), highlighted = true) {
                Column {
                    Text("YOUR ARCHETYPE", style = Kaze.type.overline, color = c.accentText)
                    Text(d.archetype, style = Kaze.type.display, color = c.text)
                    Text("Basado en los géneros que más ves y mejor calificas.", style = Kaze.type.bodySmall, color = c.textMuted)
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Stat("Titles", "${d.totalTitles}", Modifier.weight(1f))
                Stat("Completed", "${d.completed}", Modifier.weight(1f))
                Stat("Episodes", "${d.episodesWatched}", Modifier.weight(1f))
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Stat("Calif. promedio", d.averageScore?.let { "%.0f".format(it) } ?: "—", Modifier.weight(1f))
                Stat("Est. hours", "~${d.estimatedHours}", Modifier.weight(1f))
                Stat("Favourites", "${d.favoriteCount}", Modifier.weight(1f))
            }
        }
        item { Text("Est. hours assume 24 min per episode. In-app demo playback: ${demoWatchMs / 60_000} min.", style = Kaze.type.bodySmall, color = c.textMuted) }
        if (d.genreShare.isNotEmpty()) item {
            KazeCard(Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Favourite genres", style = Kaze.type.title, color = c.text)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        GenreDonut(d.genreShare, palette, Modifier.size(140.dp))
                        Spacer(Modifier.width(16.dp))
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            d.genreShare.forEachIndexed { i, (g, share) ->
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(Modifier.size(10.dp).clip(CircleShape).background(palette[i % palette.size]))
                                    Spacer(Modifier.width(6.dp))
                                    Text("$g ${(share * 100).toInt()}%", style = Kaze.type.bodySmall, color = c.text)
                                }
                            }
                        }
                    }
                }
            }
        }
        if (d.studios.isNotEmpty()) item {
            KazeCard(Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Favourite studios", style = Kaze.type.title, color = c.text)
                    val max = d.studios.maxOf { it.second }.toFloat()
                    d.studios.forEach { (s, n) ->
                        Text("$s · $n", style = Kaze.type.bodySmall, color = c.text)
                        ProgressLine(n / max, height = 6.dp)
                    }
                }
            }
        }
        item {
            KazeCard(Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Distribución de reproducción", style = Kaze.type.title, color = c.text)
                    val total = d.statusDistribution.values.sum().coerceAtLeast(1)
                    Row(Modifier.fillMaxWidth().height(16.dp).clip(Kaze.style.chipShape)) {
                        LibraryStatus.entries.forEach { s ->
                            val n = d.statusDistribution[s] ?: 0
                            if (n > 0) Box(Modifier.weight(n.toFloat()).fillMaxSize().background(statusColor(s)))
                        }
                    }
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        LibraryStatus.entries.forEach { s ->
                            val n = d.statusDistribution[s] ?: 0
                            if (n > 0) Text("${s.label} $n (${n * 100 / total}%)", style = Kaze.type.bodySmall, color = c.textMuted)
                        }
                    }
                }
            }
        }
        if (d.eras.isNotEmpty()) item {
            KazeCard(Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Favourite eras", style = Kaze.type.title, color = c.text)
                    val max = d.eras.maxOf { it.second }.toFloat()
                    Row(Modifier.fillMaxWidth().height(100.dp).semantics { contentDescription = "Titles per decade: " + d.eras.joinToString { "${it.first} ${it.second}" } }, verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        d.eras.forEach { (era, n) ->
                            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                Box(Modifier.fillMaxWidth().height((70 * n / max).dp.coerceAtLeast(4.dp)).clip(Kaze.style.chipShape).background(c.primary))
                                Text(era, style = Kaze.type.overline, color = c.textMuted)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Stat(label: String, value: String, modifier: Modifier) {
    KazeCard(modifier, padding = PaddingValues(12.dp)) {
        Column {
            Text(value, style = Kaze.type.headline, color = Kaze.colors.text)
            Text(label, style = Kaze.type.bodySmall, color = Kaze.colors.textMuted)
        }
    }
}

@Composable
private fun GenreDonut(shares: List<Pair<String, Float>>, palette: List<Color>, modifier: Modifier) {
    val sweep = remember { Animatable(0f) }
    val reduced = Kaze.reducedMotion
    LaunchedEffect(shares) { if (reduced) sweep.snapTo(1f) else sweep.animateTo(1f, tween(900)) }
    val total = shares.sumOf { it.second.toDouble() }.toFloat().coerceAtLeast(0.0001f)
    Canvas(modifier.aspectRatio(1f).semantics { contentDescription = "Genre share chart: " + shares.joinToString { "${it.first} ${(it.second * 100).toInt()} percent" } }) {
        var start = -90f
        val stroke = size.minDimension * 0.18f
        shares.forEachIndexed { i, (_, v) ->
            val angle = 360f * (v / total) * sweep.value
            drawArc(palette[i % palette.size], start, angle - 2f, false, topLeft = Offset(stroke / 2, stroke / 2), size = Size(size.width - stroke, size.height - stroke), style = Stroke(stroke))
            start += angle
        }
    }
}

@Composable
fun HistoryScreen(onBack: () -> Unit, onOpen: (Int) -> Unit, vm: HistoryViewModel = hiltViewModel()) {
    val history by vm.history.collectAsStateWithLifecycle()
    val c = Kaze.colors
    Column(Modifier.fillMaxSize()) {
        KazeTopBar("Historial de visualización", onBack, subtitle = "In-app demo playback on this device")
        val h = history
        when {
            h == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { KazeSpinner() }
            h.isEmpty() -> EmptyState("Aún no has visto nada", "Episodes you play in KAZE appear here.", icon = Icons.Filled.History)
            else -> LazyColumn(contentPadding = PaddingValues(bottom = 120.dp)) {
                items(h, key = { "${it.animeId}:${it.episode}" }) { p ->
                    Row(Modifier.fillMaxWidth().clickable(role = Role.Button) { onOpen(p.animeId) }.padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.width(96.dp).aspectRatio(16f / 9f).clip(Kaze.style.cardShape)) {
                            AnimeImage(p.bannerUrl ?: p.coverUrl, null, Modifier.fillMaxSize())
                            ProgressLine(p.fraction, Modifier.align(Alignment.BottomCenter))
                        }
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(p.animeTitle, style = Kaze.type.titleSmall, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text("Episode ${p.episode} · ${DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT).format(Date(p.updatedAt))}", style = Kaze.type.bodySmall, color = c.textMuted)
                        }
                        KazeIconButton(Icons.Filled.Delete, "Borrar historial de ${p.animeTitle}", { vm.clear(p.animeId) }, tint = c.textMuted)
                    }
                }
            }
        }
    }
}
