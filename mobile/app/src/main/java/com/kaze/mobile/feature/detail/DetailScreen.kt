package com.kaze.mobile.feature.detail

import android.content.Intent
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.filled.BookmarkAdded
import androidx.compose.material.icons.outlined.BookmarkAdd
import androidx.compose.material3.Icon
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextAlign
import com.kaze.mobile.domain.model.genreLabel
import com.kaze.mobile.domain.model.staffRoleLabel
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.automirrored.filled.PlaylistAdd
import androidx.compose.material.icons.filled.AccountTree
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.FormatListNumbered
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Theaters
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.kaze.mobile.core.common.KazeError
import com.kaze.mobile.core.designsystem.components.AnimeImage
import com.kaze.mobile.core.designsystem.components.ErrorState
import com.kaze.mobile.core.designsystem.components.KazeButton
import com.kaze.mobile.core.designsystem.components.KazeButtonKind
import com.kaze.mobile.core.designsystem.components.KazeCard
import com.kaze.mobile.core.designsystem.components.KazeChip
import com.kaze.mobile.core.designsystem.components.KazeIconButton
import com.kaze.mobile.core.designsystem.components.Pill
import com.kaze.mobile.core.designsystem.components.ProgressLine
import com.kaze.mobile.core.designsystem.components.ScoreBadge
import com.kaze.mobile.core.designsystem.components.SectionHeader
import com.kaze.mobile.core.designsystem.components.SkeletonBlock
import com.kaze.mobile.core.designsystem.components.parseHexColor
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.core.text.SafeRichText
import com.kaze.mobile.domain.model.Anime
import com.kaze.mobile.domain.model.AnimeDetail
import com.kaze.mobile.domain.model.CharacterRole
import com.kaze.mobile.domain.model.LibraryEntry
import com.kaze.mobile.domain.model.prettyEnum
import com.kaze.mobile.feature.player.PlaybackRequest
import com.kaze.mobile.feature.player.PlayerLauncher
import com.kaze.mobile.feature.player.openExternalUrl
import com.kaze.mobile.ui.components.CompletionCelebration
import com.kaze.mobile.ui.components.PosterCard
import com.kaze.mobile.ui.shared.sharedPoster
import java.text.NumberFormat

private enum class DetailTab(val label: String) { EPISODES("Episodios"), MORE("Más como esto"), DETAILS("Detalles") }

@Composable
fun DetailScreen(
    onBack: () -> Unit,
    onOpenAnime: (Anime, String?) -> Unit,
    onEpisodes: (Int) -> Unit,
    onGenre: (String) -> Unit,
    onTag: (String) -> Unit,
    onReviews: (Int, String) -> Unit,
    onWriteReview: (Int, String) -> Unit,
    onSimilarity: (Int) -> Unit,
    onWatchTogether: (Anime) -> Unit,
    expanded: Boolean,
    vm: DetailViewModel = hiltViewModel(),
) {
    val state by vm.detail.collectAsStateWithLifecycle()
    val entry by vm.entry.collectAsStateWithLifecycle()
    val progress by vm.progress.collectAsStateWithLifecycle()
    val collections by vm.collections.collectAsStateWithLifecycle()
    val inCollections by vm.inCollections.collectAsStateWithLifecycle()
    val downloads by vm.downloads.collectAsStateWithLifecycle()
    var showSheet by rememberSaveable { mutableStateOf(false) }
    var tab by rememberSaveable { mutableStateOf<DetailTab?>(null) }
    var celebrate by remember { mutableStateOf<String?>(null) }
    val snackbar = remember { SnackbarHostState() }
    val context = LocalContext.current
    val listState = rememberLazyListState()

    LaunchedEffect(Unit) {
        vm.events.collect { e ->
            when (e) {
                is DetailEvent.Completed -> celebrate = e.title
                is DetailEvent.Message -> snackbar.showSnackbar(e.text)
            }
        }
    }

    val detail = state.data
    val available = detail?.availableEpisodes() ?: 0
    val currentTab = tab ?: if (available > 0) DetailTab.EPISODES else DetailTab.MORE
    Box(Modifier.fillMaxSize()) {
        if (detail == null) {
            if (state.error != null) {
                Column(Modifier.windowInsetsPadding(WindowInsets.statusBars).padding(top = 64.dp)) {
                    ErrorState(state.error!!.userMessage, onRetry = vm::retry, offline = state.error is KazeError.Offline)
                }
            } else DetailSkeleton(vm.route.sharedKey)
        } else {
            val a = detail.anime
            val play: (Int) -> Unit = { ep -> PlayerLauncher.launch(context, PlaybackRequest(a.id, ep, a.displayTitle, a.coverUrl, a.bannerUrl, a.episodes)) }
            // Como Crunchyroll: retoma el último episodio a medias, o el siguiente al último terminado.
            val lastWatched = progress.filter { it.completed || it.positionMs > 0 }.maxByOrNull { it.updatedAt }
            val nextEp = when {
                lastWatched == null -> (entry?.progress ?: 0) + 1
                lastWatched.completed -> lastWatched.episode + 1
                else -> lastWatched.episode
            }.coerceAtMost(available.coerceAtLeast(1)).coerceAtLeast(1)
            val watchLabel = when {
                lastWatched != null && !lastWatched.completed -> "Continuar EP $nextEp"
                lastWatched == null && (entry?.progress ?: 0) == 0 -> "Empezar a ver EP 1"
                else -> "Ver EP $nextEp"
            }
            val actions = DetailActions(
                inLibrary = entry != null,
                libraryLabel = entry?.status?.label ?: "Mi lista",
                onLibrary = { showSheet = true },
                isFavorite = entry?.isFavorite == true,
                onFavorite = vm::toggleFavorite,
                onShare = { share(context, detail) },
                onTrailer = a.trailer?.url?.let { url -> { context.openExternalUrl(url) } },
                onWatchTogether = { onWatchTogether(a) },
            )
            val dl = downloads.filter { it.animeId == a.id }.associate { it.episode to it.status }
            val tabContent: LazyListScope.() -> Unit = {
                item(key = "tabs") { DetailTabs(currentTab) { tab = it } }
                when (currentTab) {
                    DetailTab.EPISODES ->
                        if (available > 0) {
                            item(key = "ep-top") { Spacer(Modifier.height(6.dp)) }
                            episodeItems(detail, entry, progress, dl, play, vm::downloadEpisode, vm::markWatched, vm::markUnwatched)
                        } else item(key = "ep-empty") { EmptyNote("Todavía no hay episodios disponibles.") }
                    DetailTab.MORE -> moreLikeThis(detail, onOpenAnime) { onSimilarity(a.id) }
                    DetailTab.DETAILS -> detailsSections(detail, entry, onTag, { onReviews(a.id, a.displayTitle) }, { onWriteReview(a.id, a.displayTitle) }, context::openExternalUrl)
                }
            }
            if (expanded) {
                Row(Modifier.fillMaxSize()) {
                    Column(Modifier.width(400.dp).fillMaxHeight().verticalScroll(rememberScrollState())) {
                        DetailHeader(detail, entry, vm.route.sharedKey, actions, onGenre, scroll = { 0 })
                        if (available > 0) KazeButton(watchLabel, { play(nextEp) }, Modifier.padding(20.dp).fillMaxWidth(), icon = Icons.Filled.PlayArrow)
                    }
                    LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(top = 48.dp, bottom = 120.dp)) { tabContent() }
                }
            } else {
                LazyColumn(state = listState, modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = if (available > 0) 110.dp else 32.dp)) {
                    item(key = "header") {
                        DetailHeader(detail, entry, vm.route.sharedKey, actions, onGenre, scroll = { if (listState.firstVisibleItemIndex == 0) listState.firstVisibleItemScrollOffset else 1200 })
                    }
                    tabContent()
                }
                if (available > 0) WatchBar(watchLabel, { play(nextEp) }, actions, Modifier.align(Alignment.BottomCenter))
            }
        }

        CollapsingTopBar(
            title = detail?.anime?.displayTitle.orEmpty(),
            onBack = onBack,
            collapsed = { listState.firstVisibleItemIndex > 0 || listState.firstVisibleItemScrollOffset > 700 },
            // Las pestañas se quedan fijas arriba al pasar de largo (como en Crunchyroll).
            pinnedTabs = { if (!expanded && detail != null && listState.firstVisibleItemIndex >= 2) currentTab else null },
            onTab = { tab = it },
        )
        SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter).padding(bottom = 104.dp))
        celebrate?.let { CompletionCelebration(it) { celebrate = null } }
    }

    if (showSheet && detail != null) {
        LibrarySheet(
            anime = detail.anime,
            entry = entry,
            collections = collections,
            inCollections = inCollections,
            onStatus = vm::setStatus,
            onProgress = vm::setProgress,
            onScore = vm::setScore,
            onFavorite = vm::toggleFavorite,
            onToggleCollection = vm::toggleCollection,
            onCreateCollection = vm::createCollection,
            onRemove = { vm.remove(); showSheet = false },
            onDismiss = { showSheet = false },
        )
    }
}

private data class DetailActions(
    val inLibrary: Boolean,
    val libraryLabel: String,
    val onLibrary: () -> Unit,
    val isFavorite: Boolean,
    val onFavorite: () -> Unit,
    val onShare: () -> Unit,
    val onTrailer: (() -> Unit)?,
    val onWatchTogether: () -> Unit,
)

private fun share(context: android.content.Context, d: AnimeDetail) {
    val text = buildString {
        append(d.anime.displayTitle)
        d.anime.score?.let { append(" — $it% en AniList") }
        append("\nhttps://www.orunei.sbs/anime/${d.anime.id}")
    }
    val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
    context.startActivity(Intent.createChooser(send, "Compartir ${d.anime.displayTitle}").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
}

@Composable
private fun CollapsingTopBar(title: String, onBack: () -> Unit, collapsed: () -> Boolean, pinnedTabs: () -> DetailTab?, onTab: (DetailTab) -> Unit) {
    val c = Kaze.colors
    val isCollapsed by remember { derivedStateOf(collapsed) }
    val pinned = pinnedTabs()
    Column(Modifier.fillMaxWidth().background(if (isCollapsed) c.background else Color.Transparent)) {
        Row(
            Modifier.fillMaxWidth().windowInsetsPadding(WindowInsets.statusBars).padding(horizontal = 4.dp, vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            KazeIconButton(Icons.AutoMirrored.Filled.ArrowBack, "Atrás", onBack, background = if (isCollapsed) Color.Transparent else c.scrim.copy(alpha = 0.5f))
            androidx.compose.animation.AnimatedVisibility(isCollapsed) {
                Text(title, style = Kaze.type.title, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(horizontal = 8.dp))
            }
        }
        if (pinned != null) DetailTabs(pinned, onTab)
    }
}

@Composable
private fun DetailTabs(current: DetailTab, onSelect: (DetailTab) -> Unit) {
    val c = Kaze.colors
    Column(Modifier.fillMaxWidth().background(c.background)) {
        Row(Modifier.padding(horizontal = 8.dp)) {
            DetailTab.entries.forEach { t ->
                val sel = t == current
                Column(
                    Modifier.width(IntrinsicSize.Max)
                        .clickable(role = Role.Tab, onClickLabel = t.label) { onSelect(t) }
                        .padding(horizontal = 12.dp).padding(top = 14.dp),
                ) {
                    Text(t.label, style = Kaze.type.titleSmall, color = if (sel) c.text else c.textMuted, maxLines = 1)
                    Spacer(Modifier.height(10.dp))
                    Box(Modifier.fillMaxWidth().height(3.dp).clip(RoundedCornerShape(topStart = 3.dp, topEnd = 3.dp)).background(if (sel) c.primary else Color.Transparent))
                }
            }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(c.text.copy(alpha = 0.08f)))
    }
}

@Composable
private fun WatchBar(label: String, onWatch: () -> Unit, actions: DetailActions, modifier: Modifier) {
    val c = Kaze.colors
    Row(
        modifier.fillMaxWidth()
            .background(Brush.verticalGradient(0f to Color.Transparent, 0.35f to c.background.copy(alpha = 0.94f), 1f to c.background))
            .windowInsetsPadding(WindowInsets.navigationBars)
            .padding(start = 16.dp, end = 16.dp, top = 22.dp, bottom = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        KazeButton(label, onWatch, Modifier.weight(1f), icon = Icons.Filled.PlayArrow, minHeight = 52.dp)
        Box(
            Modifier.size(52.dp).clip(CircleShape).border(2.dp, c.primary, CircleShape)
                .clickable(role = Role.Button, onClickLabel = if (actions.inLibrary) "En tu lista: ${actions.libraryLabel}" else "Añadir a mi lista", onClick = actions.onLibrary),
            contentAlignment = Alignment.Center,
        ) {
            Icon(if (actions.inLibrary) Icons.Filled.BookmarkAdded else Icons.Outlined.BookmarkAdd, null, tint = c.primary)
        }
    }
}

@Composable
private fun DetailHeader(detail: AnimeDetail, entry: LibraryEntry?, sharedKey: String?, actions: DetailActions, onGenre: (String) -> Unit, scroll: () -> Int) {
    val a = detail.anime
    val c = Kaze.colors
    Column {
        // The banner fades out through an alpha mask, so it melts into each theme's backdrop without a seam.
        Box(
            Modifier.fillMaxWidth().height(280.dp).clipToBounds()
                .graphicsLayer(compositingStrategy = CompositingStrategy.Offscreen)
                .drawWithContent {
                    drawContent()
                    drawRect(Brush.verticalGradient(0.45f to Color.Black, 1f to Color.Transparent), blendMode = BlendMode.DstIn)
                }
        ) {
            AnimeImage(
                a.bannerUrl ?: a.coverUrl, null,
                Modifier.fillMaxSize().graphicsLayer { translationY = scroll() * 0.5f; alpha = 1f - (scroll() / 900f).coerceIn(0f, 0.7f) },
                placeholderColor = parseHexColor(a.color),
            )
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(c.background.copy(alpha = 0.35f), Color.Transparent))))
        }
        Row(Modifier.padding(horizontal = 20.dp).pullUp(110.dp), verticalAlignment = Alignment.Bottom) {
            Box(Modifier.width(118.dp).aspectRatio(0.7f).sharedPoster(sharedKey).clip(Kaze.style.posterShape)) {
                AnimeImage(a.coverUrl, "Póster de ${a.displayTitle}", Modifier.fillMaxSize(), placeholderColor = parseHexColor(a.color))
            }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                ScoreBadge(a.score)
                detail.rankings.firstOrNull()?.let { Pill(it, color = c.accentText) }
            }
        }
        Spacer(Modifier.height(14.dp))
        Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(a.displayTitle, style = Kaze.type.headline, color = c.text, modifier = Modifier.semantics { heading() })
            if (a.titleNative != null) Text(a.titleNative, style = Kaze.type.bodySmall, color = c.textMuted)
            Text(
                listOfNotNull(a.formatLabel, a.seasonLabel, a.episodes?.let { "$it episodios" }, a.duration?.let { "$it min" }, a.status?.let(::prettyEnum)).joinToString(" · "),
                style = Kaze.type.bodySmall, color = c.textMuted,
            )
            if (a.genres.isNotEmpty()) FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                a.genres.forEach { g ->
                    Text(
                        genreLabel(g), style = Kaze.type.label, color = c.text,
                        modifier = Modifier.clip(RoundedCornerShape(50)).background(c.surfaceHigh)
                            .clickable(role = Role.Button, onClickLabel = "Buscar ${genreLabel(g)}") { onGenre(g) }
                            .padding(horizontal = 10.dp, vertical = 5.dp),
                    )
                }
            }
        }
        Spacer(Modifier.height(12.dp))
        Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
            ActionItem(if (actions.inLibrary) Icons.Filled.BookmarkAdded else Icons.Outlined.BookmarkAdd, actions.libraryLabel, actions.onLibrary, highlighted = actions.inLibrary)
            ActionItem(if (actions.isFavorite) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder, "Favorito", actions.onFavorite, highlighted = actions.isFavorite)
            ActionItem(Icons.Filled.Groups, "Ver juntos", actions.onWatchTogether)
            actions.onTrailer?.let { ActionItem(Icons.Filled.Theaters, "Tráiler", it) }
            ActionItem(Icons.Filled.Share, "Compartir", actions.onShare)
        }
        if (entry != null && (a.episodes ?: 0) > 0 && entry.progress > 0) {
            Column(Modifier.padding(horizontal = 20.dp, vertical = 6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Viste ${entry.progress} de ${a.episodes} episodios", style = Kaze.type.bodySmall, color = c.textMuted)
                ProgressLine(entry.progressFraction)
            }
        }
        Synopsis(a)
    }
}

@Composable
private fun ActionItem(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, onClick: () -> Unit, highlighted: Boolean = false) {
    val c = Kaze.colors
    Column(
        Modifier.width(72.dp).clip(RoundedCornerShape(12.dp)).clickable(role = Role.Button, onClickLabel = label, onClick = onClick).padding(vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(icon, null, tint = if (highlighted) c.primary else c.text, modifier = Modifier.size(24.dp))
        Text(label, style = Kaze.type.label, color = if (highlighted) c.primary else c.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun EmptyNote(text: String) {
    Text(text, style = Kaze.type.body, color = Kaze.colors.textMuted, modifier = Modifier.fillMaxWidth().padding(24.dp), textAlign = TextAlign.Center)
}

/** Pestaña "Más como esto": temporadas y obras relacionadas + recomendaciones de la comunidad, en cuadrícula. */
private fun LazyListScope.moreLikeThis(d: AnimeDetail, onOpenAnime: (Anime, String?) -> Unit, onSimilarity: () -> Unit) {
    if (d.relations.isNotEmpty()) {
        item(key = "rel-h") { SectionHeader("Temporadas y relacionados", modifier = Modifier.padding(top = 8.dp)) }
        posterGrid(d.relations.map { it.anime to it.label }, "rel", onOpenAnime)
    }
    if (d.recommendations.isNotEmpty()) {
        item(key = "recs-h") { SectionHeader("Si te gustó este anime", subtitle = "Recomendaciones de la comunidad", modifier = Modifier.padding(top = 8.dp)) }
        posterGrid(d.recommendations.map { it.anime to null }, "rec", onOpenAnime)
    }
    if (d.relations.isEmpty() && d.recommendations.isEmpty()) item(key = "more-empty") { EmptyNote("No hay animes relacionados todavía.") }
    item(key = "explore") {
        KazeCard(Modifier.fillMaxWidth().padding(16.dp), onClick = onSimilarity, onClickLabel = "Abrir mapa de relaciones") {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.AccountTree, null, tint = Kaze.colors.primary)
                Spacer(Modifier.width(12.dp))
                Column {
                    Text("Mapa de relaciones", style = Kaze.type.title, color = Kaze.colors.text)
                    Text("Explora animes parecidos en un mapa interactivo", style = Kaze.type.bodySmall, color = Kaze.colors.textMuted)
                }
            }
        }
    }
}

private fun LazyListScope.posterGrid(list: List<Pair<Anime, String?>>, prefix: String, onOpenAnime: (Anime, String?) -> Unit) {
    val rows = list.distinctBy { it.first.id }.chunked(3)
    items(rows.size, key = { "$prefix-row-$it" }) { i ->
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            rows[i].forEach { (anime, caption) ->
                PosterCard(anime, { onOpenAnime(anime, "$prefix-${anime.id}") }, Modifier.weight(1f), width = null, sharedKey = "$prefix-${anime.id}", caption = caption)
            }
            repeat(3 - rows[i].size) { Spacer(Modifier.weight(1f)) }
        }
    }
}

/** Pestaña "Detalles": ficha técnica, etiquetas, dónde verlo, personajes, equipo, notas y reseñas. */
private fun LazyListScope.detailsSections(
    d: AnimeDetail,
    entry: LibraryEntry?,
    onTag: (String) -> Unit,
    onReviews: () -> Unit,
    onWriteReview: () -> Unit,
    openUrl: (String) -> Unit,
) {
    item(key = "info") { InfoGrid(d) }
    val tags = d.anime.tags.filterNot { it.isSpoiler }.sortedByDescending { it.rank }.take(10)
    if (tags.isNotEmpty()) item(key = "tags") {
        FlowRow(Modifier.padding(horizontal = 20.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            tags.forEach { t -> KazeChip("#${t.name}", onClick = { onTag(t.name) }) }
        }
    }
    if (d.streamingLinks.isNotEmpty()) {
        item(key = "streaming-h") { SectionHeader("Dónde verlo oficialmente") }
        item(key = "streaming") {
            FlowRow(Modifier.padding(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                d.streamingLinks.forEach { l -> KazeChip(l.site, icon = Icons.AutoMirrored.Filled.OpenInNew, onClick = { openUrl(l.url) }) }
            }
        }
    }
    if (d.characters.isNotEmpty()) {
        item(key = "chars-h") { SectionHeader("Personajes", subtitle = "Con sus actores de voz japoneses") }
        item(key = "chars") {
            LazyRow(contentPadding = PaddingValues(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                items(d.characters, key = { it.id }) { CharacterCard(it) }
            }
        }
    }
    if (d.staff.isNotEmpty()) {
        item(key = "staff-h") { SectionHeader("Equipo de producción") }
        item(key = "staff") {
            LazyRow(contentPadding = PaddingValues(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                items(d.staff, key = { "${it.person.id}-${it.role}" }) { s ->
                    Column(Modifier.width(92.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(Modifier.size(72.dp).clip(CircleShape)) { AnimeImage(s.person.imageUrl, null, Modifier.fillMaxSize()) }
                        Spacer(Modifier.height(6.dp))
                        Text(s.person.name, style = Kaze.type.bodySmall, color = Kaze.colors.text, maxLines = 2, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
                        Text(staffRoleLabel(s.role), style = Kaze.type.label, color = Kaze.colors.textMuted, maxLines = 2, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
                    }
                }
            }
        }
    }
    if (d.scoreDistribution.isNotEmpty()) item(key = "dist") { ScoreDistribution(d.scoreDistribution, entry?.userScore) }
    item(key = "reviews-h") { SectionHeader("Reseñas", subtitle = "De la comunidad de AniList", onSeeAll = onReviews) }
    if (d.reviews.isEmpty()) item(key = "reviews-empty") {
        Text("Aún no hay reseñas de AniList.", style = Kaze.type.body, color = Kaze.colors.textMuted, modifier = Modifier.padding(horizontal = 20.dp))
    } else items(d.reviews.take(3), key = { "rev-${it.id}" }) { r ->
        KazeCard(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 6.dp), onClick = onReviews) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(28.dp).clip(CircleShape)) { AnimeImage(r.userAvatar, null, Modifier.fillMaxSize()) }
                    Spacer(Modifier.width(8.dp))
                    Text(r.userName, style = Kaze.type.titleSmall, color = Kaze.colors.text, modifier = Modifier.weight(1f))
                    r.score?.let { Pill("$it/100") }
                }
                Text(r.summary, style = Kaze.type.body, color = Kaze.colors.text, maxLines = 3, overflow = TextOverflow.Ellipsis)
                r.rating?.let { Text("A $it de ${r.ratingAmount ?: it} les resultó útil", style = Kaze.type.bodySmall, color = Kaze.colors.textMuted) }
            }
        }
    }
    item(key = "write") {
        KazeButton("Escribir una reseña", onWriteReview, kind = KazeButtonKind.Secondary, modifier = Modifier.padding(20.dp).fillMaxWidth())
    }
    item(key = "source") {
        Text("Datos de AniList", style = Kaze.type.bodySmall, color = Kaze.colors.textMuted, modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp))
    }
}

@Composable
private fun Synopsis(a: Anime) {
    var expanded by rememberSaveable { mutableStateOf(false) }
    val text = remember(a.id) { SafeRichText.htmlToAnnotated(a.description) }
    if (text.isEmpty()) return
    Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(top = 6.dp).animateContentSize(), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text, style = Kaze.type.body, color = Kaze.colors.textMuted,
            maxLines = if (expanded) Int.MAX_VALUE else 3, overflow = TextOverflow.Ellipsis,
        )
        Text(
            if (expanded) "Menos detalles" else "Más detalles",
            style = Kaze.type.titleSmall, color = Kaze.colors.primary,
            modifier = Modifier.clip(RoundedCornerShape(8.dp)).clickable(role = Role.Button) { expanded = !expanded }.padding(horizontal = 12.dp, vertical = 10.dp),
        )
    }
}

@Composable
private fun InfoGrid(d: AnimeDetail) {
    val a = d.anime
    val rows = listOfNotNull(
        "Formato" to a.formatLabel, "Episodios" to a.episodes?.toString(), "Duración" to a.duration?.let { "$it min" },
        "Estado" to a.status?.let(::prettyEnum), "Emisión" to listOfNotNull(d.startDate, d.endDate).joinToString(" – ").ifEmpty { null },
        "Temporada" to a.seasonLabel, "Estudios" to a.studios.joinToString().ifEmpty { null }, "Origen" to d.source,
        "Calificación media" to d.meanScore?.let { "$it%" }, "Favoritos" to a.favourites?.let { NumberFormat.getIntegerInstance().format(it) },
        "Próximo episodio" to a.nextEpisode?.let { ep -> a.nextAiringAt?.let { "EP $ep · ${java.text.DateFormat.getDateTimeInstance(java.text.DateFormat.MEDIUM, java.text.DateFormat.SHORT).format(java.util.Date(it * 1000))}" } },
        "Otros títulos" to d.synonyms.take(3).joinToString().ifEmpty { null },
    ).filter { it.second != null }
    KazeCard(Modifier.fillMaxWidth().padding(20.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            rows.forEach { (k, v) ->
                Row {
                    Text(k, style = Kaze.type.label, color = Kaze.colors.textMuted, modifier = Modifier.width(110.dp))
                    Text(v!!, style = Kaze.type.bodySmall, color = Kaze.colors.text)
                }
            }
        }
    }
}

/** Character cards: portrait with the voice actor's medallion pinned to the corner. */
@Composable
private fun CharacterCard(ch: CharacterRole) {
    val c = Kaze.colors
    Column(Modifier.width(120.dp).semantics(mergeDescendants = true) { contentDescription = "${ch.name}, ${ch.role}" + (ch.voiceActor?.let { ", voz de ${it.name}" } ?: "") }) {
        Box(Modifier.fillMaxWidth().aspectRatio(0.72f)) {
            Box(Modifier.fillMaxSize().clip(Kaze.style.posterShape)) {
                AnimeImage(ch.imageUrl, null, Modifier.fillMaxSize())
                Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0.55f to Color.Transparent, 1f to c.primary.copy(alpha = 0.55f))))
                Pill(ch.role, Modifier.align(Alignment.TopStart).padding(6.dp), color = if (ch.role == "Principal") c.accent else Color.White, overImage = true)
            }
            ch.voiceActor?.let { va ->
                Box(
                    Modifier.align(Alignment.BottomEnd).offset(x = 6.dp, y = 10.dp).size(46.dp).clip(CircleShape)
                        .background(c.background).padding(2.dp).clip(CircleShape)
                ) { AnimeImage(va.imageUrl, null, Modifier.fillMaxSize()) }
            }
        }
        Spacer(Modifier.height(12.dp))
        Text(ch.name, style = Kaze.type.titleSmall, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
        ch.voiceActor?.let { Text(it.name, style = Kaze.type.bodySmall, color = c.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis) }
    }
}

@Composable
private fun ScoreDistribution(dist: List<Pair<Int, Int>>, userScore: Int?) {
    val c = Kaze.colors
    val max = dist.maxOf { it.second }.coerceAtLeast(1)
    Column(Modifier.padding(horizontal = 20.dp, vertical = 8.dp)) {
        SectionHeader("Distribución de calificaciones", subtitle = userScore?.let { "Tu calificación: $it" }, modifier = Modifier.padding(start = 0.dp))
        Row(Modifier.fillMaxWidth().height(110.dp).semantics { contentDescription = "Distribución de calificaciones de la comunidad" }, verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            dist.sortedBy { it.first }.forEach { (score, amount) ->
                val mine = userScore != null && userScore in (score - 9)..score
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        Modifier.fillMaxWidth().fillMaxHeight(0.15f + 0.7f * amount / max).clip(Kaze.style.chipShape)
                            .background(if (mine) c.accent else c.primary.copy(alpha = 0.35f + 0.65f * amount / max))
                    )
                    Text("$score", style = Kaze.type.overline, color = c.textMuted)
                }
            }
        }
    }
}

@Composable
private fun DetailSkeleton(sharedKey: String?) {
    Column {
        SkeletonBlock(Modifier.fillMaxWidth().height(300.dp), shape = androidx.compose.ui.graphics.RectangleShape)
        Row(Modifier.padding(horizontal = 20.dp).pullUp(96.dp)) {
            SkeletonBlock(Modifier.width(128.dp).aspectRatio(0.7f).sharedPoster(sharedKey))
        }
        Spacer(Modifier.height(16.dp))
        Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            SkeletonBlock(Modifier.fillMaxWidth(0.8f).height(28.dp))
            SkeletonBlock(Modifier.fillMaxWidth(0.5f).height(16.dp))
            SkeletonBlock(Modifier.fillMaxWidth().height(96.dp))
        }
    }
}

/** Overlaps the previous element by [amount] *and* gives that space back to the layout (unlike offset). */
private fun Modifier.pullUp(amount: androidx.compose.ui.unit.Dp): Modifier = this.layout { measurable, constraints ->
    val placeable = measurable.measure(constraints)
    val shift = amount.roundToPx()
    layout(placeable.width, (placeable.height - shift).coerceAtLeast(0)) { placeable.place(0, -shift) }
}
