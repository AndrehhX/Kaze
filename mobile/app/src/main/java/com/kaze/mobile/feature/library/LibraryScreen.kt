package com.kaze.mobile.feature.library

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Biotech
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.CollectionsBookmark
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.ui.platform.LocalContext
import com.kaze.mobile.feature.player.PlayerLauncher
import com.kaze.mobile.feature.player.PlaybackRequest
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.SelectAll
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.Upload
import androidx.compose.material.icons.filled.VideoLibrary
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.onLongClick
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.kaze.mobile.core.designsystem.components.AnimeImage
import com.kaze.mobile.core.designsystem.components.EmptyState
import com.kaze.mobile.core.designsystem.components.KazeButton
import com.kaze.mobile.core.designsystem.components.KazeButtonKind
import com.kaze.mobile.core.designsystem.components.KazeChip
import com.kaze.mobile.core.designsystem.components.KazeIconButton
import com.kaze.mobile.core.designsystem.components.Pill
import com.kaze.mobile.core.designsystem.components.ProgressLine
import com.kaze.mobile.core.designsystem.components.parseHexColor
import com.kaze.mobile.core.designsystem.motion.staggeredReveal
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.domain.model.LibraryEntry
import com.kaze.mobile.domain.model.LibrarySort
import com.kaze.mobile.domain.model.LibraryStatus
import java.time.LocalDate

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun LibraryScreen(
    columns: Int,
    onOpen: (animeId: Int) -> Unit,
    onCollections: () -> Unit,
    onDna: () -> Unit,
    onHistory: () -> Unit,
    onSync: () -> Unit,
    onBrowse: () -> Unit,
    vm: LibraryViewModel = hiltViewModel(),
) {
    val ui by vm.ui.collectAsStateWithLifecycle()
    val filter by vm.filter.collectAsStateWithLifecycle()
    val selection by vm.selection.collectAsStateWithLifecycle()
    val collections by vm.collections.collectAsStateWithLifecycle()
    val downloads by vm.downloadRepo.downloads.collectAsStateWithLifecycle()
    var showDownloadsSheet by rememberSaveable { mutableStateOf(false) }
    val context = LocalContext.current
    val snackbar = remember { SnackbarHostState() }
    var menu by remember { mutableStateOf(false) }
    var bulkStatusSheet by rememberSaveable { mutableStateOf(false) }
    var bulkCollectionSheet by rememberSaveable { mutableStateOf(false) }
    val c = Kaze.colors
    val selecting = selection.isNotEmpty()

    val exportLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { it?.let(vm::export) }
    val importLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { it?.let(vm::import) }
    LaunchedEffect(Unit) { vm.messages.collect { snackbar.showSnackbar(it) } }

    Box(Modifier.fillMaxSize()) {
        LazyVerticalGrid(
            GridCells.Fixed(columns),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 140.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            modifier = Modifier.fillMaxSize(),
        ) {
            item(span = { GridItemSpan(maxLineSpan) }, key = "header") {
                Column(Modifier.windowInsetsPadding(WindowInsets.statusBars).padding(top = 12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(if (Kaze.style.uppercaseLabels) "BIBLIOTECA" else "Biblioteca", style = Kaze.type.display, color = c.text, modifier = Modifier.weight(1f).semantics { heading() })
                        KazeIconButton(Icons.Filled.Download, "Descargas offline", { showDownloadsSheet = true })
                        KazeIconButton(Icons.Filled.CollectionsBookmark, "Colecciones", onCollections)
                        KazeIconButton(Icons.Filled.Biotech, "ADN del anime", onDna)
                        Box {
                            KazeIconButton(Icons.Filled.MoreVert, "Más opciones de biblioteca", { menu = true })
                            DropdownMenu(menu, { menu = false }) {
                                DropdownMenuItem({ Text("Historial de reproducción") }, { menu = false; onHistory() }, leadingIcon = { Icon(Icons.Filled.History, null) })
                                DropdownMenuItem({ Text("Sincronizar con AniList") }, { menu = false; onSync() }, leadingIcon = { Icon(Icons.Filled.Sync, null) })
                                DropdownMenuItem({ Text("Exportar biblioteca (JSON)") }, { menu = false; exportLauncher.launch("kaze-library-${LocalDate.now()}.json") }, leadingIcon = { Icon(Icons.Filled.Upload, null) })
                                DropdownMenuItem({ Text("Importar biblioteca") }, { menu = false; importLauncher.launch(arrayOf("application/json", "text/plain")) }, leadingIcon = { Icon(Icons.Filled.Download, null) })
                            }
                        }
                    }
                    Text("${titleCount(ui.all.size)} · en este dispositivo", style = Kaze.type.bodySmall, color = c.textMuted)
                    Spacer(Modifier.height(12.dp))
                    Row(Modifier.fillMaxWidth().height(44.dp).background(c.surfaceHigh, Kaze.style.chipShape).border(1.dp, c.outline, Kaze.style.chipShape).padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.Search, null, tint = c.textMuted, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Box(Modifier.weight(1f)) {
                            if (filter.query.isEmpty()) Text("Buscar en tu biblioteca", style = Kaze.type.bodySmall, color = c.textMuted)
                            BasicTextField(filter.query, vm::setQuery, singleLine = true, textStyle = Kaze.type.body.copy(color = c.text), cursorBrush = SolidColor(c.primary), modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Buscar en tu biblioteca" })
                        }
                    }
                    Spacer(Modifier.height(10.dp))
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        item { KazeChip("Todos ${ui.counts[null] ?: 0}", selected = filter.status == null && !filter.favoritesOnly, onClick = { vm.setStatus(null) }) }
                        item {
                            val completedCount = downloads.count { it.status == com.kaze.mobile.data.playback.DownloadStatus.COMPLETED }
                            KazeChip("Descargas $completedCount", selected = showDownloadsSheet, icon = Icons.Filled.Download, onClick = { showDownloadsSheet = true })
                        }
                        items(LibraryStatus.entries) { s -> KazeChip("${s.label} ${ui.counts[s] ?: 0}", selected = filter.status == s, onClick = { vm.setStatus(s) }) }
                        item { KazeChip("Favoritos ${ui.favorites}", selected = filter.favoritesOnly, icon = Icons.Filled.Favorite, onClick = vm::showFavorites) }
                    }
                    Spacer(Modifier.height(6.dp))
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        items(LibrarySort.entries) { s -> KazeChip(s.label, selected = filter.sort == s, onClick = { vm.setSort(s) }) }
                        items(ui.genres) { g -> KazeChip(g, selected = filter.genre == g, onClick = { vm.setGenre(if (filter.genre == g) null else g) }) }
                    }
                }
            }

            if (ui.loaded && ui.all.isEmpty()) {
                item(span = { GridItemSpan(maxLineSpan) }) {
                    EmptyState(
                        "Tu biblioteca está vacía",
                        "Agrega animes desde su página de detalles. Todo se guarda en este dispositivo y funciona sin conexión.",
                        icon = Icons.Filled.VideoLibrary, action = "Explorar animes", onAction = onBrowse,
                    )
                }
            } else if (ui.loaded && ui.visible.isEmpty()) {
                item(span = { GridItemSpan(maxLineSpan) }) { EmptyState("No hay resultados", "Ningún anime coincide con este filtro.") }
            }

            items(ui.visible, key = { it.animeId }) { e ->
                val selected = e.animeId in selection
                LibraryCard(
                    e, selected = selected, selecting = selecting, customOrder = filter.sort == LibrarySort.CUSTOM,
                    onClick = { if (selecting) vm.toggleSelect(e.animeId) else onOpen(e.animeId) },
                    onLongClick = { vm.toggleSelect(e.animeId) },
                    onPlusOne = { vm.incrementProgress(e) },
                    onMove = { d -> vm.moveCustom(e.animeId, d) },
                    modifier = Modifier.animateItem().staggeredReveal(0),
                )
            }
        }

        AnimatedVisibility(selecting, Modifier.align(Alignment.BottomCenter), enter = slideInVertically { it }, exit = slideOutVertically { it }) {
            Row(
                Modifier.padding(start = 12.dp, end = 12.dp, bottom = 96.dp).fillMaxWidth().clip(Kaze.style.cardShape).background(c.surfaceHigh).padding(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                KazeIconButton(Icons.Filled.Close, "Cancelar selección", vm::clearSelection)
                Text("${selection.size} seleccionados", style = Kaze.type.titleSmall, color = c.text, modifier = Modifier.weight(1f))
                KazeIconButton(Icons.Filled.SelectAll, "Seleccionar todos", vm::selectAllVisible)
                KazeIconButton(Icons.Filled.CheckCircle, "Cambiar estado", { bulkStatusSheet = true })
                KazeIconButton(Icons.Filled.CollectionsBookmark, "Añadir a colección", { bulkCollectionSheet = true })
                KazeIconButton(Icons.Filled.Delete, "Eliminar seleccionados", vm::bulkRemove, tint = c.error)
            }
        }
        SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter).padding(bottom = 96.dp))
    }

    if (bulkStatusSheet) ModalBottomSheet({ bulkStatusSheet = false }, containerColor = c.surface, shape = Kaze.style.sheetShape) {
        Column(Modifier.padding(20.dp).padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Move ${titleCount(selection.size)} to…", style = Kaze.type.title, color = c.text)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                LibraryStatus.entries.forEach { s -> KazeChip(s.label, onClick = { vm.bulkStatus(s); bulkStatusSheet = false }) }
            }
        }
    }
    if (bulkCollectionSheet) ModalBottomSheet({ bulkCollectionSheet = false }, containerColor = c.surface, shape = Kaze.style.sheetShape) {
        Column(Modifier.padding(20.dp).padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Añadir ${titleCount(selection.size)} a una colección", style = Kaze.type.title, color = c.text)
            if (collections.isEmpty()) {
                Text("You have no collections yet.", style = Kaze.type.body, color = c.textMuted)
                KazeButton("Crear una", { bulkCollectionSheet = false; onCollections() }, icon = Icons.Filled.Add)
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                collections.forEach { col -> KazeChip(col.name, onClick = { vm.bulkAddToCollection(col.id); bulkCollectionSheet = false }) }
            }
        }
    }
    if (showDownloadsSheet) {
        DownloadsSheet(
            downloads = downloads.filter { it.status == com.kaze.mobile.data.playback.DownloadStatus.COMPLETED },
            totalBytes = vm.downloadRepo.totalStorageBytes(),
            onDelete = { vm.downloadRepo.deleteDownload(it) },
            onPlay = { d -> PlayerLauncher.launch(context, PlaybackRequest(d.animeId, d.episode, d.animeTitle, d.coverUrl, null, null)) },
            onDismiss = { showDownloadsSheet = false }
        )
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun LibraryCard(
    e: LibraryEntry,
    selected: Boolean,
    selecting: Boolean,
    customOrder: Boolean,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
    onPlusOne: () -> Unit,
    onMove: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val c = Kaze.colors
    Column(
        modifier
            .combinedClickable(onClick = onClick, onLongClick = onLongClick, onLongClickLabel = "Select ${e.title}")
            .semantics {
                this.selected = selected
                contentDescription = "${e.title}, ${e.status.label}, episode ${e.progress}" + (e.totalEpisodes?.let { " of $it" } ?: "")
                onLongClick(label = "Select") { onLongClick(); true }
            },
    ) {
        Box(Modifier.fillMaxWidth().aspectRatio(0.7f).clip(Kaze.style.posterShape).then(if (selected) Modifier.border(3.dp, c.primary, Kaze.style.posterShape) else Modifier)) {
            AnimeImage(e.coverUrl, null, Modifier.fillMaxSize(), placeholderColor = parseHexColor(e.color))
            Pill(e.status.label, Modifier.align(Alignment.TopStart).padding(6.dp), color = statusColor(e.status), overImage = true)
            if (e.isFavorite) Icon(Icons.Filled.Favorite, null, tint = c.accent, modifier = Modifier.align(Alignment.TopEnd).padding(6.dp).size(18.dp))
            if (selecting) Box(
                Modifier.align(Alignment.Center).size(36.dp).clip(CircleShape).background(if (selected) c.primary else c.scrim),
                contentAlignment = Alignment.Center,
            ) { if (selected) Icon(Icons.Filled.CheckCircle, null, tint = c.onPrimary) }
            else if (e.status == LibraryStatus.WATCHING || e.status == LibraryStatus.REWATCHING) {
                KazeIconButton(Icons.Filled.Add, "Marcar siguiente episodio como visto para ${e.title}", onPlusOne, Modifier.align(Alignment.BottomEnd), background = c.primary.copy(alpha = 0.9f), tint = c.onPrimary)
            }
            ProgressLine(e.progressFraction, Modifier.align(Alignment.BottomCenter))
        }
        Spacer(Modifier.height(6.dp))
        Text(e.title, style = Kaze.type.titleSmall, color = c.text, maxLines = 2, overflow = TextOverflow.Ellipsis)
        Text(
            listOfNotNull("EP ${e.progress}" + (e.totalEpisodes?.let { "/$it" } ?: ""), e.userScore?.let { "★ $it" }).joinToString(" · "),
            style = Kaze.type.bodySmall, color = c.textMuted,
        )
        if (customOrder && !selecting) Row {
            KazeIconButton(Icons.Filled.KeyboardArrowUp, "Move ${e.title} earlier", { onMove(-1) })
            KazeIconButton(Icons.Filled.KeyboardArrowDown, "Move ${e.title} later", { onMove(1) })
        }
    }
}

@Composable
fun statusColor(s: LibraryStatus) = when (s) {
    LibraryStatus.WATCHING, LibraryStatus.REWATCHING -> Kaze.colors.primary
    LibraryStatus.COMPLETED -> Kaze.colors.success
    LibraryStatus.PLANNING -> Kaze.colors.secondary
    LibraryStatus.PAUSED -> Kaze.colors.warning
    LibraryStatus.DROPPED -> Kaze.colors.error
}

private fun titleCount(n: Int) = if (n == 1) "1 anime" else "$n animes"


@Composable
private fun DownloadsSheet(
    downloads: List<com.kaze.mobile.data.playback.DownloadedEpisode>,
    totalBytes: Long,
    onDelete: (String) -> Unit,
    onPlay: (com.kaze.mobile.data.playback.DownloadedEpisode) -> Unit,
    onDismiss: () -> Unit,
) {
    val c = Kaze.colors
    ModalBottomSheet(onDismiss, containerColor = c.surface, shape = Kaze.style.sheetShape) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 36.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Capítulos descargados", style = Kaze.type.headline, color = c.text)
                    Text(
                        "${downloads.size} episodios · " + formatFileSize(totalBytes) + " · Disponibles sin conexión",
                        style = Kaze.type.bodySmall, color = c.textMuted
                    )
                }
                KazeIconButton(Icons.Filled.Close, "Cerrar", onDismiss)
            }

            if (downloads.isEmpty()) {
                EmptyState(
                    "No tienes descargas",
                    "Puedes descargar episodios desde el reproductor para verlos sin conexión a internet.",
                    icon = Icons.Filled.Download,
                )
            } else {
                downloads.forEach { d ->
                    Row(
                        Modifier.fillMaxWidth()
                            .clip(Kaze.style.cardShape)
                            .background(c.surfaceHigh)
                            .padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Box(Modifier.size(64.dp, 44.dp).clip(Kaze.style.chipShape).background(c.surface)) {
                            AnimeImage(d.coverUrl, null, Modifier.fillMaxSize())
                        }
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(d.animeTitle, style = Kaze.type.titleSmall, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(
                                "EP ${d.episode} · ${if (d.audioOption == "latino") "🇲🇽 Latino" else "🇯🇵 Sub"} · ${formatFileSize(d.fileSizeBytes)}",
                                style = Kaze.type.bodySmall, color = c.textMuted
                            )
                        }
                        KazeIconButton(Icons.Filled.PlayArrow, "Reproducir", { onPlay(d) }, tint = c.primary)
                        KazeIconButton(Icons.Filled.Delete, "Eliminar", { onDelete(d.id) }, tint = c.error)
                    }
                }
            }
        }
    }
}

private fun formatFileSize(bytes: Long): String = when {
    bytes <= 0 -> "0 MB"
    bytes < 1024 * 1024 -> "${bytes / 1024} KB"
    else -> "%.1f MB".format(bytes.toFloat() / (1024 * 1024))
}
