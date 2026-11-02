package com.kaze.mobile.feature.discover

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.rememberTransformableState
import androidx.compose.foundation.gestures.transformable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.Casino
import androidx.compose.material.icons.filled.Undo
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.kaze.mobile.core.common.KazeError
import com.kaze.mobile.core.designsystem.components.AnimeImage
import com.kaze.mobile.core.designsystem.components.EmptyState
import com.kaze.mobile.core.designsystem.components.ErrorState
import com.kaze.mobile.core.designsystem.components.KazeButton
import com.kaze.mobile.core.designsystem.components.KazeButtonKind
import com.kaze.mobile.core.designsystem.components.KazeCard
import com.kaze.mobile.core.designsystem.components.KazeChip
import com.kaze.mobile.core.designsystem.components.KazeIconButton
import com.kaze.mobile.core.designsystem.components.KazeSpinner
import com.kaze.mobile.core.designsystem.components.KazeTopBar
import com.kaze.mobile.core.designsystem.components.ScoreBadge
import com.kaze.mobile.core.designsystem.components.SkeletonBlock
import com.kaze.mobile.core.designsystem.components.parseHexColor
import com.kaze.mobile.core.designsystem.motion.staggeredReveal
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.domain.model.AniListCatalog
import com.kaze.mobile.domain.model.Anime
import com.kaze.mobile.domain.model.AnimeSeason
import com.kaze.mobile.domain.model.SearchSort
import com.kaze.mobile.domain.model.prettyEnum
import com.kaze.mobile.domain.recommendation.Mood
import com.kaze.mobile.ui.components.AnimeListRow
import com.kaze.mobile.ui.components.PosterCard
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

// =============================== Seasonal ===============================

@Composable
fun SeasonalScreen(onBack: () -> Unit, onOpenAnime: (Anime, String?) -> Unit, columns: Int, vm: SeasonalViewModel = hiltViewModel()) {
    val s by vm.state.collectAsStateWithLifecycle()
    val c = Kaze.colors
    val grid = rememberLazyGridState()
    val nearEnd by remember { derivedStateOf { (grid.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0) >= grid.layoutInfo.totalItemsCount - 6 } }
    LaunchedEffect(nearEnd) { if (nearEnd) vm.loadMore() }

    Column(Modifier.fillMaxSize()) {
        KazeTopBar("Seasonal anime", onBack, subtitle = "AniList seasonal chart")
        Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            KazeIconButton(Icons.AutoMirrored.Filled.ArrowBack, "Temporada anterior", vm::previous)
            AnimatedContent(s.season to s.year, Modifier.weight(1f), label = "season") { (season, year) ->
                Text("${prettyEnum(season.name)} $year", style = Kaze.type.headline, color = c.text, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
            }
            KazeIconButton(Icons.AutoMirrored.Filled.ArrowForward, "Próxima temporada", vm::next)
        }
        LazyRow(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            items(AnimeSeason.entries) { season -> KazeChip(prettyEnum(season.name), selected = s.season == season, onClick = { vm.select(season) }) }
            item { Spacer(Modifier.width(12.dp)) }
            items(listOf(null, "TV", "MOVIE", "ONA", "OVA")) { f -> KazeChip(f?.let(::prettyEnum) ?: "All formats", selected = s.format == f, onClick = { vm.setFormat(f) }) }
            item { Spacer(Modifier.width(12.dp)) }
            items(listOf(SearchSort.POPULARITY_DESC, SearchSort.SCORE_DESC, SearchSort.TRENDING_DESC)) { so -> KazeChip(so.label, selected = s.sort == so, onClick = { vm.setSort(so) }) }
        }
        when {
            s.error != null && s.items.isEmpty() -> ErrorState(s.error!!.userMessage, onRetry = vm::retry, offline = s.error is KazeError.Offline)
            !s.loading && s.items.isEmpty() -> EmptyState("Nothing announced yet", "AniList has no titles for this season with these filters.")
            else -> LazyVerticalGrid(
                GridCells.Fixed(columns), state = grid,
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 120.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(18.dp),
            ) {
                itemsIndexed(s.items, key = { _, a -> a.id }) { i, a ->
                    PosterCard(a, { onOpenAnime(a, "seasonal-${a.id}") }, Modifier.staggeredReveal(i % 12), width = null, sharedKey = "seasonal-${a.id}",
                        caption = a.nextAiringAt?.let { "Ep ${a.nextEpisode} airs soon" } ?: listOfNotNull(a.formatLabel, a.studios.firstOrNull()).joinToString(" · "))
                }
                if (s.loading) {
                    if (s.items.isEmpty()) items(columns * 3) { SkeletonBlock(Modifier.fillMaxWidth().aspectRatio(0.7f)) }
                    else item(span = { GridItemSpan(maxLineSpan) }) { Box(Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) { KazeSpinner() } }
                }
            }
        }
    }
}

// =============================== Mood Explorer ===============================

@Composable
fun MoodScreen(onBack: () -> Unit, onOpenAnime: (Anime, String?) -> Unit, vm: MoodViewModel = hiltViewModel()) {
    val s by vm.state.collectAsStateWithLifecycle()
    val c = Kaze.colors
    androidx.compose.foundation.lazy.LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 120.dp)) {
        item { KazeTopBar("Mood Explorer", onBack, subtitle = "How do you want to feel tonight?") }
        item {
            FlowRow(Modifier.padding(horizontal = 16.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp), maxItemsInEachRow = 4) {
                Mood.entries.forEach { m ->
                    val selected = s.mood == m
                    KazeCard(
                        Modifier.width(80.dp).height(92.dp),
                        onClick = { vm.pick(m) }, onClickLabel = "Choose ${m.label} mood",
                        highlighted = selected, padding = PaddingValues(8.dp),
                    ) {
                        Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                            Text(m.glyph, style = Kaze.type.headline, color = if (selected) c.accent else c.primary)
                            Text(m.label, style = Kaze.type.bodySmall, color = c.text, maxLines = 1)
                        }
                    }
                }
            }
        }
        val mood = s.mood
        if (mood == null) {
            item { EmptyState("Choose a mood", "Each mood maps to AniList genres and tags. We'll show you exactly which ones.") }
        } else {
            item {
                KazeCard(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Why these picks", style = Kaze.type.overline, color = c.accentText)
                        Text(mood.explanation, style = Kaze.type.body, color = c.text)
                        Text(
                            "Genres: ${mood.genres.joinToString()}" + (if (mood.tags.isNotEmpty() && !s.relaxed) " · Tags: ${mood.tags.joinToString()}" else "") +
                                (if (mood.excluded.isNotEmpty()) " · Excluding: ${mood.excluded.joinToString()}" else ""),
                            style = Kaze.type.bodySmall, color = c.textMuted,
                        )
                        if (s.relaxed) Text("Few titles matched the tag, so we widened to genres only.", style = Kaze.type.bodySmall, color = c.warning)
                    }
                }
            }
            when {
                s.loading -> item { Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) { KazeSpinner() } }
                s.error != null -> item { ErrorState(s.error!!.userMessage, onRetry = { vm.pick(mood) }) }
                else -> items(s.items, key = { it.id }) { a ->
                    AnimeListRow(a, { onOpenAnime(a, "mood-${a.id}") }, sharedKey = "mood-${a.id}",
                        trailing = "Matches ${(a.genres intersect mood.genres).joinToString().ifEmpty { mood.label.lowercase() }}")
                }
            }
        }
    }
}

// =============================== Anime Roulette ===============================

private val SpinEasing = CubicBezierEasing(0.08f, 0.82f, 0.17f, 1f)

/** Signature interaction #4 — a decelerating poster reel that lands on a genuinely random pick. */
@Composable
fun RouletteScreen(onBack: () -> Unit, onOpenAnime: (Anime, String?) -> Unit, vm: RouletteViewModel = hiltViewModel()) {
    val s by vm.state.collectAsStateWithLifecycle()
    val c = Kaze.colors
    val reduced = Kaze.reducedMotion
    val offset = remember { Animatable(0f) }
    var landed by remember { mutableStateOf(false) }

    LaunchedEffect(s.spinId) {
        val winner = s.winnerIndex ?: return@LaunchedEffect
        landed = false
        val loops = 4
        val target = (loops * s.pool.size + winner).toFloat()
        offset.snapTo(0f)
        if (reduced) offset.snapTo(target) else offset.animateTo(target, tween(3600, easing = SpinEasing))
        landed = true
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        KazeTopBar("Anime Roulette", onBack, subtitle = "Genuinely random — no editorial picks")
        Box(Modifier.fillMaxWidth().height(260.dp), contentAlignment = Alignment.Center) {
            val itemW = 132.dp
            val pxW = with(LocalDensity.current) { itemW.toPx() }
            val pool = s.pool
            if (pool.isEmpty()) {
                Text(if (s.loading) "Shuffling the catalogue…" else "Set your filters and spin", style = Kaze.type.title, color = c.textMuted)
            } else {
                val center = offset.value
                val first = floor(center).toInt() - 3
                for (i in first..first + 6) {
                    if (i < 0) continue
                    val a = pool[i % pool.size]
                    val dx = (i - center) * pxW * 1.08f
                    val dist = kotlin.math.abs(i - center)
                    Box(
                        Modifier
                            .width(itemW).aspectRatio(0.7f)
                            .graphicsLayer {
                                translationX = dx
                                val sc = 1f - (dist * 0.16f).coerceAtMost(0.4f)
                                scaleX = sc; scaleY = sc
                                alpha = 1f - (dist * 0.25f).coerceAtMost(0.75f)
                                rotationY = (i - center) * -14f
                                cameraDistance = 14f * density
                            }
                            .clip(Kaze.style.posterShape)
                    ) { AnimeImage(a.coverUrl, null, Modifier.fillMaxSize(), placeholderColor = parseHexColor(a.color)) }
                }
                // Selection frame
                Box(
                    Modifier.width(itemW + 10.dp).aspectRatio(0.7f)
                        .border(3.dp, Brush.linearGradient(listOf(c.primary, c.accent)), Kaze.style.posterShape)
                )
            }
        }

        val winner = s.winnerIndex?.let { s.pool.getOrNull(it) }
        AnimatedContent(
            targetState = if (landed) winner else null,
            transitionSpec = { (scaleIn(spring(0.55f, Spring.StiffnessMediumLow), 0.85f) + fadeIn()) togetherWith fadeOut(tween(100)) },
            label = "winner",
        ) { w ->
            if (w != null) {
                KazeCard(Modifier.fillMaxWidth().padding(16.dp).semantics { liveRegion = LiveRegionMode.Polite }, highlighted = true, onClick = { onOpenAnime(w, null) }, onClickLabel = "Open ${w.displayTitle}") {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Fate has chosen", style = Kaze.type.overline, color = c.accentText)
                        Text(w.displayTitle, style = Kaze.type.headline, color = c.text)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                            ScoreBadge(w.score)
                            Text(listOfNotNull(w.formatLabel, w.seasonLabel, w.episodes?.let { "$it eps" }).joinToString(" · "), style = Kaze.type.bodySmall, color = c.textMuted)
                        }
                        Text(w.genres.joinToString(" • "), style = Kaze.type.bodySmall, color = c.primary)
                        Text("Picked uniformly at random from ${s.pool.size} matching titles.", style = Kaze.type.bodySmall, color = c.textMuted)
                    }
                }
            } else Spacer(Modifier.height(1.dp))
        }

        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            KazeButton(if (s.pool.isEmpty()) "Spin" else "Spin again", vm::spin, icon = Icons.Filled.Casino, loading = s.loading, modifier = Modifier.fillMaxWidth())
            s.error?.let { Text(it.userMessage, style = Kaze.type.bodySmall, color = c.error) }
            Text("Genres", style = Kaze.type.title, color = c.text)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                AniListCatalog.genres.filterNot { it == "Ecchi" }.forEach { g -> KazeChip(g, selected = g in s.genres, onClick = { vm.toggleGenre(g) }) }
            }
            Text("Format", style = Kaze.type.title, color = c.text)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf(null, "TV", "MOVIE", "ONA").forEach { f -> KazeChip(f?.let(::prettyEnum) ?: "Any", selected = s.format == f, onClick = { vm.setFormat(f) }) }
            }
            Text("Calificación mínima", style = Kaze.type.title, color = c.text)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf(null, 60, 70, 80).forEach { m -> KazeChip(m?.let { "$it%+" } ?: "Any", selected = s.minScore == m, onClick = { vm.setMinScore(m) }) }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Skip anime already in my library", style = Kaze.type.body, color = c.text, modifier = Modifier.weight(1f))
                Switch(s.excludeOwned, vm::setExcludeOwned, colors = SwitchDefaults.colors(checkedTrackColor = c.primary))
            }
            Spacer(Modifier.height(100.dp))
        }
    }
}

// =============================== Similarity Explorer ===============================

@Composable
fun SimilarityScreen(onBack: () -> Unit, onOpenAnime: (Anime, String?) -> Unit, vm: SimilarityViewModel = hiltViewModel()) {
    val s by vm.state.collectAsStateWithLifecycle()
    val c = Kaze.colors
    val reduced = Kaze.reducedMotion
    var scale by remember { mutableFloatStateOf(1f) }
    var pan by remember { mutableStateOf(Offset.Zero) }
    val transform = rememberTransformableState { zoom, p, _ ->
        scale = (scale * zoom).coerceIn(0.6f, 2.4f)
        pan += p
    }
    val reveal = remember { Animatable(0f) }
    LaunchedEffect(s.center?.anime?.id) {
        reveal.snapTo(0f)
        if (reduced) reveal.snapTo(1f) else reveal.animateTo(1f, spring(0.75f, Spring.StiffnessLow))
    }

    Column(Modifier.fillMaxSize()) {
        KazeTopBar(
            "Similarity Explorer", onBack, subtitle = s.center?.anime?.displayTitle,
            actions = {
                if (s.trail.isNotEmpty()) KazeIconButton(Icons.Filled.Undo, "Volver al anime anterior", vm::back)
                s.center?.anime?.let { a -> KazeIconButton(Icons.AutoMirrored.Filled.OpenInNew, "Open ${a.displayTitle}", { onOpenAnime(a, null) }) }
            },
        )
        Row(Modifier.padding(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Legend(c.accent, "Related (sequels, prequels…)")
            Legend(c.primary, "Recommended by users")
        }
        Box(Modifier.fillMaxSize()) {
            when {
                s.loading && s.center == null -> KazeSpinner(Modifier.align(Alignment.Center).size(40.dp))
                s.error != null && s.center == null -> ErrorState(s.error!!.userMessage)
                s.center != null -> BoxWithConstraints(
                    Modifier.fillMaxSize().transformable(transform).graphicsLayer {
                        scaleX = scale; scaleY = scale; translationX = pan.x; translationY = pan.y
                    }
                ) {
                    val density = LocalDensity.current
                    val w = with(density) { maxWidth.toPx() }
                    val h = with(density) { maxHeight.toPx() }
                    val cx = w / 2; val cy = h / 2 - with(density) { 30.dp.toPx() }
                    val base = min(w, h)
                    val rel = s.nodes.filter { it.kind == GraphNode.Kind.RELATION }
                    val recs = s.nodes.filter { it.kind == GraphNode.Kind.RECOMMENDATION }
                    fun pos(i: Int, n: Int, r: Float, phase: Float): Offset {
                        val angle = (2 * PI * i / n.coerceAtLeast(1) + phase).toFloat()
                        return Offset(cx + cos(angle) * r * reveal.value, cy + sin(angle) * r * reveal.value)
                    }
                    val relPos = rel.indices.map { pos(it, rel.size, base * 0.26f, -PI.toFloat() / 2) }
                    val recPos = recs.indices.map { pos(it, recs.size, base * 0.44f, -PI.toFloat() / 2 + 0.3f) }
                    Canvas(Modifier.fillMaxSize()) {
                        relPos.forEach { drawLine(c.accent.copy(alpha = 0.7f), Offset(cx, cy), it, strokeWidth = 3f) }
                        recPos.forEach { drawLine(c.primary.copy(alpha = 0.45f), Offset(cx, cy), it, strokeWidth = 2f, pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 10f))) }
                    }
                    val centerAnime = s.center!!.anime
                    GraphBubble(centerAnime, null, 88.dp, Offset(cx, cy), c.accent, onClick = { onOpenAnime(centerAnime, null) })
                    rel.forEachIndexed { i, n -> GraphBubble(n.anime, n.label, 56.dp, relPos[i], c.accent) { vm.focus(n.anime.id, centerAnime) } }
                    recs.forEachIndexed { i, n -> GraphBubble(n.anime, null, 48.dp, recPos[i], c.primary) { vm.focus(n.anime.id, centerAnime) } }
                }
            }
            if (s.loading && s.center != null) KazeSpinner(Modifier.align(Alignment.TopEnd).padding(16.dp).size(24.dp))
            Text(
                "Tap a node to re-centre · pinch to zoom · ${s.nodes.size} connections",
                style = Kaze.type.bodySmall, color = c.textMuted,
                modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 110.dp),
            )
        }
    }
}

@Composable
private fun Legend(color: androidx.compose.ui.graphics.Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(10.dp).clip(CircleShape).background(color))
        Spacer(Modifier.width(6.dp))
        Text(label, style = Kaze.type.bodySmall, color = Kaze.colors.textMuted)
    }
}

@Composable
private fun GraphBubble(anime: Anime, label: String?, size: androidx.compose.ui.unit.Dp, at: Offset, ring: androidx.compose.ui.graphics.Color, onClick: () -> Unit) {
    val half = with(LocalDensity.current) { (size / 2).toPx() }
    Column(
        Modifier.offset { IntOffset((at.x - half).roundToInt(), (at.y - half).roundToInt()) }.width(size),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            Modifier.size(size).clip(CircleShape).border(2.dp, ring, CircleShape)
                .clickable(role = Role.Button, onClickLabel = "Explore ${anime.displayTitle}", onClick = onClick)
                .semantics { contentDescription = anime.displayTitle + (label?.let { ", $it" } ?: "") }
        ) { AnimeImage(anime.coverUrl, null, Modifier.fillMaxSize(), placeholderColor = parseHexColor(anime.color)) }
        if (label != null) Text(label, style = Kaze.type.overline, color = ring, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
    }
}
