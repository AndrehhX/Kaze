package com.kaze.mobile.feature.library

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.IntrinsicSize
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Biotech
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Replay
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.Upload
import androidx.compose.material.icons.filled.Wifi
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.kaze.mobile.core.designsystem.components.AnimeImage
import com.kaze.mobile.core.designsystem.components.KazeChip
import com.kaze.mobile.core.designsystem.components.KazeIconButton
import com.kaze.mobile.core.designsystem.components.MascotEmptyState
import com.kaze.mobile.core.designsystem.components.Pill
import com.kaze.mobile.core.designsystem.components.ProgressLine
import com.kaze.mobile.core.designsystem.components.parseHexColor
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.data.playback.DownloadStatus
import com.kaze.mobile.data.playback.DownloadedEpisode
import com.kaze.mobile.domain.model.AnimeCollection
import com.kaze.mobile.domain.model.LibraryEntry
import com.kaze.mobile.domain.model.LibrarySort
import com.kaze.mobile.domain.model.LibraryStatus
import com.kaze.mobile.domain.model.WatchProgress
import com.kaze.mobile.feature.player.PlaybackRequest
import com.kaze.mobile.feature.player.PlayerLauncher
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.time.LocalDate
import java.time.ZoneId
import java.util.Date
import java.util.Locale

private enum class ListsTab(val key: String, val label: String) {
    FOLLOWING("following", "Siguiendo"), LISTS("lists", "Listas"), HISTORY("history", "Historial"), DOWNLOADS("downloads", "Descargas"),
}

/** "Mis listas": lo que sigues, tus listas, tu historial y tus descargas, en cuatro pestañas. */
@Composable
fun LibraryScreen(
    initialTab: String?,
    columns: Int,
    onOpen: (animeId: Int) -> Unit,
    onOpenCollection: (Long) -> Unit,
    onDna: () -> Unit,
    onSync: () -> Unit,
    onBrowse: () -> Unit,
    vm: LibraryViewModel = hiltViewModel(),
) {
    val c = Kaze.colors
    val context = LocalContext.current
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val pager = rememberPagerState(initialPage = ListsTab.entries.indexOfFirst { it.key == initialTab }.coerceAtLeast(0)) { ListsTab.entries.size }
    var menu by remember { mutableStateOf(false) }
    var searching by rememberSaveable { mutableStateOf(false) }
    val exportLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { it?.let(vm::export) }
    val importLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { it?.let(vm::import) }
    LaunchedEffect(Unit) { vm.messages.collect { snackbar.showSnackbar(it) } }
    LaunchedEffect(initialTab) { ListsTab.entries.indexOfFirst { it.key == initialTab }.takeIf { it >= 0 }?.let { pager.scrollToPage(it) } }

    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {
            Row(Modifier.windowInsetsPadding(WindowInsets.statusBars).padding(start = 20.dp, end = 8.dp, top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(if (Kaze.style.uppercaseLabels) "MIS LISTAS" else "Mis listas", style = Kaze.type.headline, color = c.text, modifier = Modifier.weight(1f).semantics { heading() })
                if (pager.currentPage == 0) KazeIconButton(if (searching) Icons.Filled.Close else Icons.Filled.Search, if (searching) "Cerrar búsqueda" else "Buscar en tus animes", { searching = !searching; if (!searching) vm.setQuery("") })
                Box {
                    KazeIconButton(Icons.Filled.MoreVert, "Más opciones", { menu = true })
                    DropdownMenu(menu, { menu = false }) {
                        DropdownMenuItem({ Text("ADN de tu anime") }, { menu = false; onDna() }, leadingIcon = { Icon(Icons.Filled.Biotech, null) })
                        DropdownMenuItem({ Text("Sincronizar con AniList") }, { menu = false; onSync() }, leadingIcon = { Icon(Icons.Filled.Sync, null) })
                        DropdownMenuItem({ Text("Exportar copia (JSON)") }, { menu = false; exportLauncher.launch("kaze-mis-listas-${LocalDate.now()}.json") }, leadingIcon = { Icon(Icons.Filled.Upload, null) })
                        DropdownMenuItem({ Text("Importar copia") }, { menu = false; importLauncher.launch(arrayOf("application/json", "text/plain")) }, leadingIcon = { Icon(Icons.Filled.Download, null) })
                    }
                }
            }
            ListsTabs(ListsTab.entries[pager.currentPage]) { t -> scope.launch { pager.animateScrollToPage(t.ordinal) } }
            HorizontalPager(pager, Modifier.weight(1f), beyondViewportPageCount = 0) { page ->
                when (ListsTab.entries[page]) {
                    ListsTab.FOLLOWING -> FollowingTab(vm, searching, onOpen, onBrowse)
                    ListsTab.LISTS -> ListsTabContent(vm, onOpenCollection)
                    ListsTab.HISTORY -> HistoryTab(vm, columns, onBrowse)
                    ListsTab.DOWNLOADS -> DownloadsTab(vm, onBrowse) { d ->
                        PlayerLauncher.launch(context, PlaybackRequest(d.animeId, d.episode, d.animeTitle, d.coverUrl, d.bannerUrl, d.totalEpisodes))
                    }
                }
            }
        }
        SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter).padding(bottom = 104.dp))
    }
}

@Composable
private fun ListsTabs(current: ListsTab, onSelect: (ListsTab) -> Unit) {
    val c = Kaze.colors
    Column(Modifier.fillMaxWidth()) {
        Row(Modifier.padding(horizontal = 8.dp)) {
            ListsTab.entries.forEach { t ->
                val sel = t == current
                Column(
                    Modifier.weight(1f).width(IntrinsicSize.Max)
                        .clickable(role = Role.Tab, onClickLabel = t.label) { onSelect(t) }
                        .padding(horizontal = 4.dp).padding(top = 12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(t.label, style = Kaze.type.titleSmall, color = if (sel) c.text else c.textMuted, maxLines = 1)
                    Spacer(Modifier.height(10.dp))
                    Box(Modifier.fillMaxWidth(0.8f).height(3.dp).clip(RoundedCornerShape(topStart = 3.dp, topEnd = 3.dp)).background(if (sel) c.primary else Color.Transparent))
                }
            }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(c.text.copy(alpha = 0.08f)))
    }
}

// ───────────────────────────────────────────────────────────── Siguiendo

@Composable
private fun FollowingTab(vm: LibraryViewModel, searching: Boolean, onOpen: (Int) -> Unit, onBrowse: () -> Unit) {
    val c = Kaze.colors
    val context = LocalContext.current
    val ui by vm.ui.collectAsStateWithLifecycle()
    val filter by vm.filter.collectAsStateWithLifecycle()
    val latest by vm.latest.collectAsStateWithLifecycle()
    val collections by vm.collections.collectAsStateWithLifecycle()
    var filterSheet by rememberSaveable { mutableStateOf(false) }
    var addTo by remember { mutableStateOf<LibraryEntry?>(null) }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 130.dp)) {
        item(key = "bar") {
            Column(Modifier.padding(horizontal = 20.dp).padding(top = 10.dp)) {
                AnimatedVisibility(searching) {
                    Row(Modifier.fillMaxWidth().padding(bottom = 10.dp).height(44.dp).background(c.surfaceHigh, Kaze.style.chipShape).padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.Search, null, tint = c.textMuted, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Box(Modifier.weight(1f)) {
                            if (filter.query.isEmpty()) Text("Buscar en tus animes", style = Kaze.type.bodySmall, color = c.textMuted)
                            BasicTextField(filter.query, vm::setQuery, singleLine = true, textStyle = Kaze.type.body.copy(color = c.text), cursorBrush = SolidColor(c.primary), modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Buscar en tus animes" })
                        }
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            when {
                                filter.favoritesOnly -> "Favoritos"
                                filter.status != null -> filter.status!!.label
                                else -> "Todos"
                            } + " · ${ui.visible.size}",
                            style = Kaze.type.title, color = c.text,
                        )
                        Text(filter.sort.label, style = Kaze.type.bodySmall, color = c.textMuted)
                    }
                    KazeIconButton(Icons.Filled.Tune, "Filtrar y ordenar", { filterSheet = true })
                }
            }
        }
        if (ui.loaded && ui.all.isEmpty()) item(key = "empty") {
            MascotEmptyState(
                "Aún no sigues ningún anime",
                "Empieza a ver un episodio y aparecerá aquí solo, para que sigas donde te quedaste.",
                action = "Explorar animes", onAction = onBrowse,
            )
        } else if (ui.loaded && ui.visible.isEmpty()) item(key = "none") {
            MascotEmptyState("Nada por aquí", "Ningún anime coincide con este filtro.")
        }
        items(ui.visible, key = { it.animeId }) { e ->
            FollowingRow(
                e, latest[e.animeId],
                onOpen = { onOpen(e.animeId) },
                onPlay = { ep -> PlayerLauncher.launch(context, PlaybackRequest(e.animeId, ep, e.title, e.coverUrl, e.bannerUrl, e.totalEpisodes)) },
                onFavorite = { vm.setFavorite(e, !e.isFavorite) },
                onStatus = { s -> vm.setStatusOf(e, s) },
                onAddToList = { addTo = e },
                onRemove = { vm.removeEntry(e) },
            )
        }
    }

    if (filterSheet) ModalBottomSheet({ filterSheet = false }, containerColor = c.surface, shape = Kaze.style.sheetShape) {
        Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Mostrar", style = Kaze.type.title, color = c.text)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                KazeChip("Todos ${ui.counts[null] ?: 0}", selected = filter.status == null && !filter.favoritesOnly, onClick = { vm.setStatus(null) })
                KazeChip("Favoritos ${ui.favorites}", selected = filter.favoritesOnly, icon = Icons.Filled.Favorite, onClick = vm::showFavorites)
                LibraryStatus.entries.forEach { s -> KazeChip("${s.label} ${ui.counts[s] ?: 0}", selected = filter.status == s, onClick = { vm.setStatus(s) }) }
            }
            Spacer(Modifier.height(4.dp))
            Text("Ordenar por", style = Kaze.type.title, color = c.text)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                LibrarySort.entries.filter { it != LibrarySort.CUSTOM }.forEach { s -> KazeChip(s.label, selected = filter.sort == s, onClick = { vm.setSort(s) }) }
            }
        }
    }
    addTo?.let { e ->
        ModalBottomSheet({ addTo = null }, containerColor = c.surface, shape = Kaze.style.sheetShape) {
            Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Añadir ${e.title} a…", style = Kaze.type.title, color = c.text)
                if (collections.isEmpty()) Text("Todavía no tienes listas. Créalas en la pestaña Listas.", style = Kaze.type.body, color = c.textMuted)
                collections.forEach { col ->
                    val inIt = col.items.any { it.animeId == e.animeId }
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).clickable(enabled = !inIt) { vm.addToCollection(col.id, e); addTo = null }.padding(vertical = 12.dp, horizontal = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(col.name, style = Kaze.type.body, color = c.text, modifier = Modifier.weight(1f))
                        if (inIt) Icon(Icons.Filled.CheckCircle, "Ya está en la lista", tint = c.primary)
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun FollowingRow(
    e: LibraryEntry,
    last: WatchProgress?,
    onOpen: () -> Unit,
    onPlay: (Int) -> Unit,
    onFavorite: () -> Unit,
    onStatus: (LibraryStatus) -> Unit,
    onAddToList: () -> Unit,
    onRemove: () -> Unit,
) {
    val c = Kaze.colors
    var menu by remember { mutableStateOf(false) }
    val total = e.totalEpisodes
    // Como Crunchyroll: qué te toca ver a continuación.
    val (actionLabel, actionEp) = when {
        last != null && !last.completed && last.positionMs > 0 -> "Continuar: EP ${last.episode}" to last.episode
        total != null && e.progress >= total -> "Ver de nuevo: EP 1" to 1
        e.progress == 0 && last == null -> "Empezar a ver: EP 1" to 1
        else -> "Continuar: EP ${e.progress + 1}" to (e.progress + 1)
    }
    Row(
        Modifier.fillMaxWidth().combinedClickable(onClick = onOpen, onLongClick = { menu = true }, onClickLabel = "Abrir ${e.title}").padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        Box(Modifier.width(92.dp).aspectRatio(0.7f).clip(Kaze.style.posterShape).background(c.surfaceHigh)) {
            AnimeImage(e.coverUrl, null, Modifier.fillMaxSize(), placeholderColor = parseHexColor(e.color))
            if (total != null && total > 0) ProgressLine(e.progressFraction, Modifier.align(Alignment.BottomCenter))
        }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f).height(131.dp)) {
            Text(e.title, style = Kaze.type.titleSmall, color = c.text, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(4.dp))
            Row(
                Modifier.clip(RoundedCornerShape(50)).clickable(role = Role.Button, onClickLabel = actionLabel) { onPlay(actionEp) }.padding(vertical = 4.dp, horizontal = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(if (actionLabel.startsWith("Ver de nuevo")) Icons.Filled.Replay else Icons.Filled.PlayArrow, null, tint = c.primary, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(4.dp))
                Text(actionLabel, style = Kaze.type.bodySmall, color = c.primary)
            }
            Spacer(Modifier.weight(1f))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Pill(e.status.label, color = statusColor(e.status))
                Spacer(Modifier.width(8.dp))
                Text("EP ${e.progress}" + (total?.let { "/$it" } ?: ""), style = Kaze.type.bodySmall, color = c.textMuted, modifier = Modifier.weight(1f))
                KazeIconButton(if (e.isFavorite) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder, if (e.isFavorite) "Quitar de favoritos" else "Añadir a favoritos", onFavorite, tint = if (e.isFavorite) c.accent else c.textMuted)
                Box {
                    KazeIconButton(Icons.Filled.MoreVert, "Opciones de ${e.title}", { menu = true }, tint = c.textMuted)
                    DropdownMenu(menu, { menu = false }) {
                        LibraryStatus.entries.filter { it != e.status }.forEach { s ->
                            DropdownMenuItem({ Text("Mover a ${s.label}") }, { menu = false; onStatus(s) })
                        }
                        DropdownMenuItem({ Text("Añadir a una lista") }, { menu = false; onAddToList() })
                        DropdownMenuItem({ Text("Quitar de Mis listas", color = c.error) }, { menu = false; onRemove() })
                    }
                }
            }
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

// ───────────────────────────────────────────────────────────── Listas

@Composable
private fun ListsTabContent(vm: LibraryViewModel, onOpenCollection: (Long) -> Unit) {
    val c = Kaze.colors
    val collections by vm.collections.collectAsStateWithLifecycle()
    var creating by rememberSaveable { mutableStateOf(false) }
    var editing by remember { mutableStateOf<AnimeCollection?>(null) }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 130.dp)) {
        item(key = "bar") {
            Row(Modifier.padding(start = 20.dp, end = 8.dp, top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(if (collections.size == 1) "1 lista" else "${collections.size} listas", style = Kaze.type.title, color = c.text, modifier = Modifier.weight(1f))
                Text(
                    "Crear nueva lista", style = Kaze.type.titleSmall, color = c.primary,
                    modifier = Modifier.clip(RoundedCornerShape(8.dp)).clickable(role = Role.Button) { creating = true }.padding(horizontal = 12.dp, vertical = 10.dp),
                )
            }
        }
        if (collections.isEmpty()) item(key = "empty") {
            MascotEmptyState("Arma tus propias listas", "Agrupa animes como quieras: \"Para el finde\", \"Joyas ocultas\", \"Isekai chill\"… Se guardan también en la web.", action = "Crear mi primera lista", onAction = { creating = true })
        }
        items(collections, key = { it.id }) { col ->
            CollectionCard(col, onClick = { onOpenCollection(col.id) }, onEdit = { editing = col }, onDelete = { vm.deleteCollection(col.id) })
        }
    }
    if (creating) CollectionEditor("Nueva lista", "", "", false, null, onSave = { n, d, p -> vm.createCollection(n, d, p); creating = false }, onDismiss = { creating = false })
    editing?.let { col -> CollectionEditor("Editar lista", col.name, col.description, col.isPublic, null, onSave = { n, d, p -> vm.updateCollection(col.id, n, d, p); editing = null }, onDismiss = { editing = null }) }
}

@Composable
private fun CollectionCard(col: AnimeCollection, onClick: () -> Unit, onEdit: () -> Unit, onDelete: () -> Unit) {
    val c = Kaze.colors
    var menu by remember { mutableStateOf(false) }
    val date = remember(col.updatedAt) { if (col.updatedAt > 0) SimpleDateFormat("d MMM yyyy", Locale("es")).format(Date(col.updatedAt)) else null }
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp).clip(Kaze.style.cardShape).background(c.surfaceHigh)
            .clickable(role = Role.Button, onClickLabel = "Abrir ${col.name}", onClick = onClick).padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Mosaico de hasta 4 portadas.
        Box(Modifier.size(84.dp).clip(RoundedCornerShape(10.dp)).background(c.surface)) {
            val covers = col.items.take(4)
            if (covers.isEmpty()) Icon(Icons.Filled.Favorite, null, tint = c.primary.copy(alpha = 0.5f), modifier = Modifier.align(Alignment.Center))
            else Column(Modifier.fillMaxSize()) {
                listOf(0, 2).forEach { start ->
                    Row(Modifier.weight(1f)) {
                        listOf(start, start + 1).forEach { i ->
                            Box(Modifier.weight(1f).fillMaxSize().padding(0.5.dp)) {
                                covers.getOrNull(i)?.let { AnimeImage(it.coverUrl, null, Modifier.fillMaxSize(), placeholderColor = parseHexColor(it.color)) }
                                    ?: Box(Modifier.fillMaxSize().background(c.primary.copy(alpha = 0.12f)))
                            }
                        }
                    }
                }
            }
        }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(col.name, style = Kaze.type.titleSmall, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(
                (if (col.items.size == 1) "1 anime" else "${col.items.size} animes") + (date?.let { " · $it" } ?: ""),
                style = Kaze.type.bodySmall, color = c.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(if (col.isPublic) Icons.Filled.Public else Icons.Filled.Lock, null, tint = c.textMuted, modifier = Modifier.size(13.dp))
                Spacer(Modifier.width(4.dp))
                Text(if (col.isPublic) "Pública" else "Privada", style = Kaze.type.label, color = c.textMuted)
            }
        }
        Box {
            KazeIconButton(Icons.Filled.MoreVert, "Opciones de ${col.name}", { menu = true }, tint = c.textMuted)
            DropdownMenu(menu, { menu = false }) {
                DropdownMenuItem({ Text("Editar") }, { menu = false; onEdit() })
                DropdownMenuItem({ Text("Borrar lista", color = c.error) }, { menu = false; onDelete() })
            }
        }
    }
}

// ───────────────────────────────────────────────────────────── Historial

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun HistoryTab(vm: LibraryViewModel, columns: Int, onBrowse: () -> Unit) {
    val c = Kaze.colors
    val context = LocalContext.current
    val history by vm.history.collectAsStateWithLifecycle()
    var managing by rememberSaveable { mutableStateOf(false) }
    var selected by remember { mutableStateOf(setOf<String>()) }
    val h = history.orEmpty()
    val groups = remember(h) { groupByDay(h) }
    val cols = (columns / 1.5).toInt().coerceIn(2, 4)
    Box(Modifier.fillMaxSize()) {
        LazyVerticalGrid(GridCells.Fixed(cols), Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 150.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            item(span = { GridItemSpan(maxLineSpan) }, key = "bar") {
                Row(Modifier.padding(top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(if (managing) "${selected.size} seleccionados" else "Lo último que viste", style = Kaze.type.title, color = c.text, modifier = Modifier.weight(1f))
                    if (h.isNotEmpty()) Text(
                        if (managing) "Listo" else "Gestionar", style = Kaze.type.titleSmall, color = c.primary,
                        modifier = Modifier.clip(RoundedCornerShape(8.dp)).clickable(role = Role.Button) { managing = !managing; selected = emptySet() }.padding(horizontal = 12.dp, vertical = 10.dp),
                    )
                }
            }
            if (history != null && h.isEmpty()) item(span = { GridItemSpan(maxLineSpan) }, key = "empty") {
                MascotEmptyState("Tu historial está vacío", "Los episodios que veas en KAZE (aquí o en la web) aparecerán aquí.", action = "Buscar algo para ver", onAction = onBrowse)
            }
            groups.forEach { (label, rows) ->
                item(span = { GridItemSpan(maxLineSpan) }, key = "h-$label") { Text(label, style = Kaze.type.overline, color = c.accentText, modifier = Modifier.padding(top = 6.dp)) }
                items(rows, key = { "${it.animeId}:${it.episode}" }) { p ->
                    val key = "${p.animeId}:${p.episode}"
                    HistoryCard(
                        p, managing, key in selected,
                        onClick = {
                            if (managing) selected = if (key in selected) selected - key else selected + key
                            else PlayerLauncher.launch(context, PlaybackRequest(p.animeId, p.episode, p.animeTitle, p.coverUrl, p.bannerUrl, null))
                        },
                        onLongClick = { managing = true; selected = selected + key },
                    )
                }
            }
        }
        AnimatedVisibility(managing, Modifier.align(Alignment.BottomCenter)) {
            Row(
                Modifier.padding(start = 12.dp, end = 12.dp, bottom = 100.dp).fillMaxWidth().clip(Kaze.style.cardShape).background(c.surfaceHigh).padding(8.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    "Borrar todo", style = Kaze.type.titleSmall, color = c.error,
                    modifier = Modifier.clip(RoundedCornerShape(8.dp)).clickable(role = Role.Button) { vm.clearHistory(); managing = false; selected = emptySet() }.padding(12.dp),
                )
                Spacer(Modifier.weight(1f))
                com.kaze.mobile.core.designsystem.components.KazeButton(
                    "Borrar (${selected.size})", { vm.deleteHistory(selected); selected = emptySet(); managing = false },
                    icon = Icons.Filled.Delete, enabled = selected.isNotEmpty(), minHeight = 44.dp,
                )
            }
        }
    }
}

private fun groupByDay(h: List<WatchProgress>): List<Pair<String, List<WatchProgress>>> {
    val zone = ZoneId.systemDefault()
    val today = LocalDate.now(zone)
    return h.groupBy { p ->
        val d = java.time.Instant.ofEpochMilli(p.updatedAt).atZone(zone).toLocalDate()
        when {
            d == today -> "Hoy"
            d == today.minusDays(1) -> "Ayer"
            d.isAfter(today.minusDays(7)) -> "Esta semana"
            d.isAfter(today.minusDays(31)) -> "Este mes"
            else -> "Antes"
        }
    }.toList()
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun HistoryCard(p: WatchProgress, managing: Boolean, selected: Boolean, onClick: () -> Unit, onLongClick: () -> Unit) {
    val c = Kaze.colors
    Column(Modifier.combinedClickable(onClick = onClick, onLongClick = onLongClick, onClickLabel = "Ver ${p.animeTitle} episodio ${p.episode}")) {
        Box(Modifier.fillMaxWidth().aspectRatio(16f / 9f).clip(RoundedCornerShape(8.dp)).background(c.surfaceHigh).then(if (selected) Modifier.border(3.dp, c.primary, RoundedCornerShape(8.dp)) else Modifier)) {
            AnimeImage(p.bannerUrl ?: p.coverUrl, null, Modifier.fillMaxSize().alpha(if (p.completed) 0.55f else 1f))
            Box(Modifier.align(Alignment.Center).size(34.dp).clip(CircleShape).background(Color.Black.copy(alpha = 0.45f)), contentAlignment = Alignment.Center) {
                Icon(
                    when { managing && selected -> Icons.Filled.CheckCircle; managing -> Icons.Filled.RadioButtonUnchecked; p.completed -> Icons.Filled.Replay; else -> Icons.Filled.PlayArrow },
                    null, tint = Color.White, modifier = Modifier.size(20.dp),
                )
            }
            val badge = if (p.completed) "Visto" else "${((p.durationMs - p.positionMs).coerceAtLeast(0) / 60_000).coerceAtLeast(1)}m restantes"
            Text(badge, color = Color.White, style = Kaze.type.label, modifier = Modifier.align(Alignment.BottomEnd).padding(5.dp).clip(RoundedCornerShape(3.dp)).background(Color.Black.copy(alpha = 0.7f)).padding(horizontal = 5.dp, vertical = 1.dp))
            if (!p.completed && p.positionMs > 0) Box(Modifier.align(Alignment.BottomStart).fillMaxWidth().height(3.dp).background(Color.White.copy(alpha = 0.25f))) {
                Box(Modifier.fillMaxWidth(p.fraction.coerceIn(0.03f, 1f)).height(3.dp).background(c.primary))
            }
        }
        Spacer(Modifier.height(6.dp))
        Text(p.animeTitle, style = Kaze.type.bodySmall, color = c.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text("Episodio ${p.episode}", style = Kaze.type.titleSmall, color = c.text, maxLines = 1)
    }
}

// ───────────────────────────────────────────────────────────── Descargas

@Composable
private fun DownloadsTab(vm: LibraryViewModel, onBrowse: () -> Unit, onPlay: (DownloadedEpisode) -> Unit) {
    val c = Kaze.colors
    val downloads by vm.downloadRepo.downloads.collectAsStateWithLifecycle()
    val prefs by vm.prefs.collectAsStateWithLifecycle()
    val byAnime = remember(downloads) { downloads.groupBy { it.animeId }.values.toList() }
    val used = downloads.sumOf { it.fileSizeBytes }
    val free = remember(downloads.size) { vm.downloadRepo.freeBytes() }
    var qualitySheet by remember { mutableStateOf(false) }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 130.dp)) {
        item(key = "storage") {
            Column(Modifier.padding(horizontal = 16.dp, vertical = 10.dp).fillMaxWidth().clip(Kaze.style.cardShape).background(c.surfaceHigh).padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("${formatBytes(used)} en descargas", style = Kaze.type.titleSmall, color = c.text, modifier = Modifier.weight(1f))
                    Text("${formatBytes(free)} libres", style = Kaze.type.bodySmall, color = c.textMuted)
                }
                ProgressLine(if (used + free > 0) used.toFloat() / (used + free) else 0f)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    KazeChip(if (prefs?.downloadWifiOnly != false) "Solo con Wi-Fi" else "Wi-Fi y datos", selected = prefs?.downloadWifiOnly != false, icon = Icons.Filled.Wifi, onClick = { vm.setWifiOnly(prefs?.downloadWifiOnly == false) })
                    KazeChip("Calidad ${prefs?.downloadQuality ?: 720}p", onClick = { qualitySheet = true })
                }
            }
        }
        if (downloads.isEmpty()) item(key = "empty") {
            MascotEmptyState("No hay descargas… ¡aún!", "Toca el botón de descarga en cualquier episodio para verlo cuando estés sin conexión.", action = "Explorar animes", onAction = onBrowse)
        }
        byAnime.forEach { eps ->
            val first = eps.first()
            item(key = "a-${first.animeId}") {
                Row(Modifier.padding(start = 16.dp, end = 8.dp, top = 12.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(36.dp, 50.dp).clip(RoundedCornerShape(6.dp)).background(c.surfaceHigh)) { AnimeImage(first.coverUrl, null, Modifier.fillMaxSize()) }
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(first.animeTitle, style = Kaze.type.titleSmall, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text((if (eps.size == 1) "1 episodio" else "${eps.size} episodios") + " · ${formatBytes(eps.sumOf { it.fileSizeBytes })}", style = Kaze.type.bodySmall, color = c.textMuted)
                    }
                    KazeIconButton(Icons.Filled.Delete, "Borrar todas las descargas de ${first.animeTitle}", { vm.downloadRepo.deleteAnime(first.animeId) }, tint = c.textMuted)
                }
            }
            items(eps, key = { "d-${it.id}" }) { d -> DownloadRow(d, vm, onPlay) }
        }
    }
    if (qualitySheet) ModalBottomSheet({ qualitySheet = false }, containerColor = c.surface, shape = Kaze.style.sheetShape) {
        Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Calidad de descarga", style = Kaze.type.title, color = c.text)
            Text("Más calidad ocupa más espacio. Aplica a las próximas descargas.", style = Kaze.type.bodySmall, color = c.textMuted)
            listOf(480 to "Ahorro · ~150 MB por episodio", 720 to "Recomendada · ~300 MB", 1080 to "Máxima · ~600 MB").forEach { (q, note) ->
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).clickable(role = Role.RadioButton) { vm.setQuality(q); qualitySheet = false }.padding(vertical = 12.dp, horizontal = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text("${q}p", style = Kaze.type.body, color = if (prefs?.downloadQuality == q) c.primary else c.text)
                        Text(note, style = Kaze.type.bodySmall, color = c.textMuted)
                    }
                    if (prefs?.downloadQuality == q) Icon(Icons.Filled.CheckCircle, "Seleccionada", tint = c.primary)
                }
            }
        }
    }
}

@Composable
private fun DownloadRow(d: DownloadedEpisode, vm: LibraryViewModel, onPlay: (DownloadedEpisode) -> Unit) {
    val c = Kaze.colors
    val done = d.status == DownloadStatus.COMPLETED
    Row(
        Modifier.fillMaxWidth()
            .clickable(role = Role.Button, onClickLabel = if (done) "Ver sin conexión" else null) {
                when (d.status) {
                    DownloadStatus.COMPLETED -> onPlay(d)
                    DownloadStatus.FAILED -> vm.downloadRepo.retry(d)
                    else -> Unit
                }
            }
            .padding(horizontal = 16.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.width(120.dp).aspectRatio(16f / 9f).clip(RoundedCornerShape(6.dp)).background(c.surfaceHigh)) {
            AnimeImage(d.bannerUrl ?: d.coverUrl, null, Modifier.fillMaxSize().alpha(if (done) 1f else 0.6f))
            if (done) Box(Modifier.align(Alignment.Center).size(30.dp).clip(CircleShape).background(Color.Black.copy(alpha = 0.45f)), contentAlignment = Alignment.Center) {
                Icon(Icons.Filled.PlayArrow, null, tint = Color.White, modifier = Modifier.size(18.dp))
            }
            if (!done && d.status != DownloadStatus.FAILED) Box(Modifier.align(Alignment.BottomStart).fillMaxWidth().height(3.dp).background(Color.White.copy(alpha = 0.25f))) {
                Box(Modifier.fillMaxWidth(d.progress.coerceIn(0.02f, 1f)).height(3.dp).background(c.primary))
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text("Episodio ${d.episode}", style = Kaze.type.body, color = c.text)
            Text(
                when (d.status) {
                    DownloadStatus.COMPLETED -> "${d.quality}p · ${formatBytes(d.fileSizeBytes)} · ${if (d.audioOption == "latino") "Latino" else "Japonés"}"
                    DownloadStatus.DOWNLOADING -> "Descargando ${(d.progress * 100).toInt()}% · ${formatBytes(d.fileSizeBytes)}"
                    DownloadStatus.QUEUED -> "Preparando…"
                    DownloadStatus.PAUSED -> "En pausa · ${(d.progress * 100).toInt()}%"
                    DownloadStatus.WAITING -> "Esperando Wi-Fi · ${(d.progress * 100).toInt()}%"
                    DownloadStatus.FAILED -> d.error ?: "Falló · toca para reintentar"
                },
                style = Kaze.type.bodySmall, color = if (d.status == DownloadStatus.FAILED) c.error else c.textMuted, maxLines = 2, overflow = TextOverflow.Ellipsis,
            )
        }
        when (d.status) {
            DownloadStatus.DOWNLOADING, DownloadStatus.QUEUED, DownloadStatus.WAITING -> KazeIconButton(Icons.Filled.Pause, "Pausar", { vm.downloadRepo.pause(d.id) }, tint = c.textMuted)
            DownloadStatus.PAUSED -> KazeIconButton(Icons.Filled.Download, "Reanudar", { vm.downloadRepo.resume(d.id) }, tint = c.primary)
            DownloadStatus.FAILED -> KazeIconButton(Icons.Filled.ErrorOutline, "Reintentar", { vm.downloadRepo.retry(d) }, tint = c.error)
            DownloadStatus.COMPLETED -> Unit
        }
        KazeIconButton(Icons.Filled.Delete, "Borrar descarga", { vm.downloadRepo.deleteDownload(d.id) }, tint = c.textMuted)
    }
}

private fun formatBytes(bytes: Long): String = when {
    bytes <= 0 -> "0 MB"
    bytes < 1024L * 1024 -> "${bytes / 1024} KB"
    bytes < 1024L * 1024 * 1024 -> "%.0f MB".format(bytes / (1024f * 1024))
    else -> "%.1f GB".format(bytes / (1024f * 1024 * 1024))
}
