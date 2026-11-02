package com.kaze.mobile.feature.discover

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Badge
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.kaze.mobile.core.common.KazeError
import com.kaze.mobile.core.designsystem.components.EmptyState
import com.kaze.mobile.core.designsystem.components.ErrorState
import com.kaze.mobile.core.designsystem.components.KazeButton
import com.kaze.mobile.core.designsystem.components.KazeButtonKind
import com.kaze.mobile.core.designsystem.components.KazeChip
import com.kaze.mobile.core.designsystem.components.KazeIconButton
import com.kaze.mobile.core.designsystem.components.KazeSpinner
import com.kaze.mobile.core.designsystem.motion.staggeredReveal
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.domain.model.AniListCatalog
import com.kaze.mobile.domain.model.Anime
import com.kaze.mobile.domain.model.AnimeSeason
import com.kaze.mobile.domain.model.SearchFilters
import com.kaze.mobile.domain.model.SearchSort
import com.kaze.mobile.domain.model.prettyEnum
import com.kaze.mobile.ui.components.PosterCard
import java.time.LocalDate

@Composable
fun SearchScreen(
    onBack: () -> Unit,
    onOpenAnime: (Anime, String?) -> Unit,
    columns: Int,
    vm: SearchViewModel = hiltViewModel(),
) {
    val state by vm.state.collectAsStateWithLifecycle()
    val saved by vm.savedSearches.collectAsStateWithLifecycle()
    val genres by vm.genres.collectAsStateWithLifecycle()
    val tags by vm.tags.collectAsStateWithLifecycle()
    var showFilters by rememberSaveable { mutableStateOf(false) }
    val focus = remember { FocusRequester() }
    val grid = rememberLazyGridState()
    val c = Kaze.colors

    LaunchedEffect(Unit) { if (state.filters.isEmpty) runCatching { focus.requestFocus() } }
    val nearEnd by remember { derivedStateOf { grid.layoutInfo.visibleItemsInfo.lastOrNull()?.index?.let { it >= grid.layoutInfo.totalItemsCount - 6 } == true } }
    LaunchedEffect(nearEnd) { if (nearEnd) vm.loadMore() }

    Column(Modifier.fillMaxSize().imePadding()) {
        Row(
            Modifier.fillMaxWidth().windowInsetsPadding(WindowInsets.statusBars).padding(horizontal = 8.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            KazeIconButton(Icons.AutoMirrored.Filled.ArrowBack, "Back", onBack)
            Row(
                Modifier.weight(1f).height(48.dp).background(c.surfaceHigh, Kaze.style.chipShape).border(1.dp, c.outline, Kaze.style.chipShape).padding(horizontal = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Filled.Search, null, tint = c.textMuted)
                Spacer(Modifier.width(8.dp))
                Box(Modifier.weight(1f)) {
                    if (state.filters.query.isEmpty()) Text("Buscar títulos, ej. Frieren", style = Kaze.type.body, color = c.textMuted)
                    BasicTextField(
                        value = state.filters.query,
                        onValueChange = vm::setQuery,
                        singleLine = true,
                        textStyle = Kaze.type.body.copy(color = c.text),
                        cursorBrush = SolidColor(c.primary),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                        keyboardActions = KeyboardActions(onSearch = { vm.submit() }),
                        modifier = Modifier.fillMaxWidth().focusRequester(focus).semantics { contentDescription = "Buscar anime" },
                    )
                }
                if (state.filters.query.isNotEmpty()) KazeIconButton(Icons.Filled.Close, "Borrar búsqueda", { vm.setQuery("") })
            }
            BadgedBox(badge = { if (state.filters.activeCount > 0) Badge { Text("${state.filters.activeCount}") } }) {
                KazeIconButton(Icons.Filled.Tune, "Advanced filters", { showFilters = true })
            }
        }

        if (state.filters.activeCount > 0) {
            FlowRow(Modifier.padding(horizontal = 16.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                state.filters.genres.forEach { g -> KazeChip(g, selected = true, icon = Icons.Filled.Close, onClick = { vm.setFilters(state.filters.copy(genres = state.filters.genres - g)) }) }
                state.filters.excludedGenres.forEach { g -> KazeChip("Not $g", icon = Icons.Filled.Close, onClick = { vm.setFilters(state.filters.copy(excludedGenres = state.filters.excludedGenres - g)) }) }
                state.filters.tags.forEach { t -> KazeChip("#$t", selected = true, icon = Icons.Filled.Close, onClick = { vm.setFilters(state.filters.copy(tags = state.filters.tags - t)) }) }
                listOfNotNull(state.filters.season?.let(::prettyEnum), state.filters.year?.toString(), state.filters.format?.let(::prettyEnum), state.filters.status?.let(::prettyEnum), state.filters.minScore?.let { "≥ $it%" })
                    .forEach { KazeChip(it, selected = true) }
                KazeChip("Clear", onClick = vm::clearFilters)
            }
        }

        when {
            !state.searched && state.filters.isEmpty -> SearchSuggestions(saved, genres, onPick = vm::setQuery, onGenre = { vm.setFilters(state.filters.copy(genres = setOf(it))) }, onClearHistory = { vm.clearHistory() })
            state.error != null && state.results.isEmpty() -> ErrorState(state.error!!.userMessage, onRetry = vm::submit, offline = state.error is KazeError.Offline)
            state.searched && state.results.isEmpty() && !state.loading -> EmptyState("No matches", "Try fewer filters or a different spelling. AniList searches romaji, English and native titles.", icon = Icons.Filled.Search)
            else -> LazyVerticalGrid(
                columns = GridCells.Fixed(columns),
                state = grid,
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 120.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp),
                modifier = Modifier.fillMaxSize(),
            ) {
                itemsIndexed(state.results, key = { _, a -> a.id }) { i, a ->
                    PosterCard(a, { onOpenAnime(a, "search-${a.id}") }, Modifier.fillMaxWidth().staggeredReveal(i % 12), width = null, sharedKey = "search-${a.id}")
                }
                if (state.loading) item(span = { GridItemSpan(maxLineSpan) }) {
                    Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) { KazeSpinner() }
                }
            }
        }
    }

    if (showFilters) {
        AdvancedFiltersSheet(
            initial = state.filters,
            genres = genres,
            tags = tags,
            onApply = { vm.setFilters(it); showFilters = false },
            onDismiss = { showFilters = false },
        )
    }
}

@Composable
private fun SearchSuggestions(saved: List<String>, genres: List<String>, onPick: (String) -> Unit, onGenre: (String) -> Unit, onClearHistory: () -> Unit) {
    val c = Kaze.colors
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        if (saved.isNotEmpty()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Recent searches", style = Kaze.type.title, color = c.text, modifier = Modifier.weight(1f))
                KazeButton("Limpiar", onClearHistory, kind = KazeButtonKind.Ghost)
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                saved.forEach { KazeChip(it, icon = Icons.Filled.History, onClick = { onPick(it) }) }
            }
        }
        Text("Explorar por género", style = Kaze.type.title, color = c.text)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            genres.forEach { KazeChip(it, onClick = { onGenre(it) }) }
        }
        Spacer(Modifier.windowInsetsPadding(WindowInsets.navigationBars).height(80.dp))
    }
}

/** Advanced filters: include/exclude genres (tri-state), tags, season, year, format, status, score, sort. */
@Composable
fun AdvancedFiltersSheet(
    initial: SearchFilters,
    genres: List<String>,
    tags: List<String>,
    onApply: (SearchFilters) -> Unit,
    onDismiss: () -> Unit,
) {
    var f by remember { mutableStateOf(initial) }
    var tagQuery by remember { mutableStateOf("") }
    val c = Kaze.colors
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val thisYear = LocalDate.now().year
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheet, containerColor = c.surface, shape = Kaze.style.sheetShape) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text("Advanced filters", style = Kaze.type.headline, color = c.text)
            Text("Toca un género para incluirlo, de nuevo para excluirlo, o una tercera vez para limpiarlo.", style = Kaze.type.bodySmall, color = c.textMuted)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                genres.forEach { g ->
                    val included = g in f.genres
                    val excluded = g in f.excludedGenres
                    KazeChip(
                        if (excluded) "Not $g" else g,
                        selected = included,
                        icon = if (excluded) Icons.Filled.Remove else null,
                        onClick = {
                            f = when {
                                included -> f.copy(genres = f.genres - g, excludedGenres = f.excludedGenres + g)
                                excluded -> f.copy(excludedGenres = f.excludedGenres - g)
                                else -> f.copy(genres = f.genres + g)
                            }
                        },
                    )
                }
            }
            if (tags.isNotEmpty()) {
                Text("Tags", style = Kaze.type.title, color = c.text)
                Row(Modifier.fillMaxWidth().height(44.dp).background(c.surfaceHigh, Kaze.style.chipShape).padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.weight(1f)) {
                        if (tagQuery.isEmpty()) Text("Find a tag (e.g. Time Travel)", style = Kaze.type.bodySmall, color = c.textMuted)
                        BasicTextField(tagQuery, { tagQuery = it.take(40) }, singleLine = true, textStyle = Kaze.type.body.copy(color = c.text), cursorBrush = SolidColor(c.primary), modifier = Modifier.fillMaxWidth())
                    }
                }
                val shown = remember(tagQuery, tags, f.tags) {
                    (f.tags.toList() + tags.filter { tagQuery.isNotBlank() && it.contains(tagQuery, true) && it !in f.tags }.take(12))
                }
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    shown.forEach { t -> KazeChip(t, selected = t in f.tags, onClick = { f = f.copy(tags = if (t in f.tags) f.tags - t else f.tags + t) }) }
                }
            }
            Text("Season", style = Kaze.type.title, color = c.text)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                AnimeSeason.entries.forEach { s -> KazeChip(prettyEnum(s.name), selected = f.season == s.name, onClick = { f = f.copy(season = if (f.season == s.name) null else s.name) }) }
            }
            Text("Year: ${f.year ?: "Any"}", style = Kaze.type.title, color = c.text)
            Slider(
                value = (f.year ?: (thisYear + 1)).toFloat(),
                onValueChange = { v -> f = f.copy(year = v.toInt().takeIf { it <= thisYear }) },
                valueRange = 1970f..(thisYear + 1).toFloat(),
                steps = thisYear + 1 - 1970 - 1,
                colors = SliderDefaults.colors(thumbColor = c.primary, activeTrackColor = c.primary),
                modifier = Modifier.semantics { contentDescription = "Release year, slide fully right for any year" },
            )
            Text("Formato", style = Kaze.type.title, color = c.text)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                AniListCatalog.formats.forEach { x -> KazeChip(prettyEnum(x), selected = f.format == x, onClick = { f = f.copy(format = if (f.format == x) null else x) }) }
            }
            Text("Estado", style = Kaze.type.title, color = c.text)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                AniListCatalog.statuses.forEach { x -> KazeChip(prettyEnum(x), selected = f.status == x, onClick = { f = f.copy(status = if (f.status == x) null else x) }) }
            }
            Text("Calificación mínima: ${f.minScore?.let { "$it%" } ?: "Cualquiera"}", style = Kaze.type.title, color = c.text)
            Slider(
                value = (f.minScore ?: 0).toFloat(),
                onValueChange = { v -> f = f.copy(minScore = v.toInt().takeIf { it > 0 }) },
                valueRange = 0f..95f, steps = 18,
                colors = SliderDefaults.colors(thumbColor = c.primary, activeTrackColor = c.primary),
            )
            Text("Ordenar por", style = Kaze.type.title, color = c.text)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                SearchSort.entries.forEach { s -> KazeChip(s.label, selected = f.sort == s, onClick = { f = f.copy(sort = s) }) }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                KazeButton("Reset", { f = SearchFilters(query = f.query) }, kind = KazeButtonKind.Secondary)
                KazeButton("Show results", { onApply(f) }, modifier = Modifier.weight(1f))
            }
        }
    }
}
