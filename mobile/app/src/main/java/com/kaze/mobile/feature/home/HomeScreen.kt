package com.kaze.mobile.feature.home

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PagerState
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Theaters
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.kaze.mobile.core.common.KazeError
import com.kaze.mobile.core.designsystem.components.AnimeImage
import com.kaze.mobile.core.designsystem.components.ErrorState
import com.kaze.mobile.core.designsystem.components.KazeButton
import com.kaze.mobile.core.designsystem.components.KazeButtonKind
import com.kaze.mobile.core.designsystem.components.KazeChip
import com.kaze.mobile.core.designsystem.components.KazeIconButton
import com.kaze.mobile.core.designsystem.components.OfflineBanner
import com.kaze.mobile.core.designsystem.components.ScoreBadge
import com.kaze.mobile.core.designsystem.components.SectionHeader
import com.kaze.mobile.core.designsystem.components.SkeletonBlock
import com.kaze.mobile.core.designsystem.components.parseHexColor
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.core.designsystem.theme.MotionPersonality
import com.kaze.mobile.core.designsystem.theme.Ornament
import com.kaze.mobile.core.text.SafeRichText
import com.kaze.mobile.domain.model.Anime
import com.kaze.mobile.feature.player.PlayerLauncher
import com.kaze.mobile.feature.player.PlaybackRequest
import com.kaze.mobile.feature.player.openExternalUrl
import com.kaze.mobile.ui.components.WideEpisodeCard
import com.kaze.mobile.ui.components.animeRail
import kotlinx.coroutines.delay
import java.util.concurrent.TimeUnit
import kotlin.math.absoluteValue

@Composable
fun HomeScreen(
    onOpenAnime: (Anime, String?) -> Unit,
    onSearch: () -> Unit,
    onNotifications: () -> Unit,
    onSeasonal: () -> Unit,
    onSeeAll: (genre: String?) -> Unit,
    friendsSection: @Composable () -> Unit = {},
    vm: HomeViewModel = hiltViewModel(),
) {
    val catalog by vm.catalog.collectAsStateWithLifecycle()
    val cont by vm.continueWatching.collectAsStateWithLifecycle()
    val library by vm.libraryIds.collectAsStateWithLifecycle()
    val recommended by vm.recommended.collectAsStateWithLifecycle()
    val favGenre by vm.favoriteGenre.collectAsStateWithLifecycle()
    val because by vm.becauseYouLiked.collectAsStateWithLifecycle()
    val online by vm.isOnline.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val data = catalog.data
    val listState = rememberLazyListState()

    PullToRefreshBox(isRefreshing = catalog.loading && data != null, onRefresh = vm::refresh, modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 120.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item(key = "hero", contentType = "hero") {
                if (data != null && data.trending.isNotEmpty()) {
                    HeroCarousel(
                        items = data.trending.take(6),
                        inLibrary = { library.containsKey(it) },
                        onOpen = { onOpenAnime(it, "hero-${it.id}") },
                        onWatch = { a ->
                            val resume = cont.firstOrNull { it.animeId == a.id }
                            PlayerLauncher.launch(context, PlaybackRequest(a.id, resume?.episode ?: 1, a.displayTitle, a.coverUrl, a.bannerUrl, a.episodes))
                        },
                        onToggleList = vm::toggleInList,
                        onTrailer = { a -> a.trailer?.url?.let(context::openExternalUrl) },
                        scrollOffset = { if (listState.firstVisibleItemIndex == 0) listState.firstVisibleItemScrollOffset else 2000 },
                    )
                } else if (catalog.error == null || data != null) {
                    SkeletonBlock(Modifier.fillMaxWidth().height(540.dp), shape = androidx.compose.ui.graphics.RectangleShape)
                }
            }
            if (!online || (data?.fromCache == true && catalog.error != null)) item(key = "offline") { OfflineBanner() }
            if (data == null && catalog.error != null) {
                item(key = "error") {
                    Column(Modifier.windowInsetsPadding(WindowInsets.statusBars).padding(top = 80.dp)) {
                        ErrorState(catalog.error!!.userMessage, onRetry = vm::refresh, offline = catalog.error is KazeError.Offline)
                    }
                }
            }

            if (cont.isNotEmpty()) {
                item(key = "continue-h") { SectionHeader("Continuar viendo", subtitle = "Sigue donde lo dejaste", index = 1) }
                item(key = "continue") {
                    LazyRow(contentPadding = PaddingValues(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        items(cont, key = { "cw-${it.animeId}" }) { p ->
                            val a = Anime(id = p.animeId, title = p.animeTitle, coverUrl = p.coverUrl, bannerUrl = p.bannerUrl)
                            WideEpisodeCard(
                                a, "EP ${p.episode} · ${remaining(p.durationMs - p.positionMs)} restante",
                                onClick = { PlayerLauncher.launch(context, PlaybackRequest(p.animeId, p.episode, p.animeTitle, p.coverUrl, p.bannerUrl, null)) },
                                progress = p.fraction,
                            )
                        }
                    }
                }
            }

            animeRail("trending", "Tendencias del momento", data?.trending?.drop(6)?.ifEmpty { data.trending } ?: if (catalog.error == null) null else emptyList(),
                onOpenAnime, subtitle = "Lo más visto de la semana", index = 2, onSeeAll = { onSeeAll(null) })
            animeRail("season", "Populares de la temporada", data?.popularSeason, onOpenAnime, index = 3, onSeeAll = onSeasonal)

            recommended?.let { recs ->
                if (recs.isNotEmpty()) animeRail(
                    "foryou", "Recomendado para ti", recs.map { it.anime }, onOpenAnime,
                    subtitle = recs.first().reason, index = 4,
                    captionFor = { a -> recs.firstOrNull { it.anime.id == a.id }?.reason?.removePrefix("Recommended because ") },
                ) else item(key = "foryou-empty") { PersonalizeHint() }
            }

            data?.recentlyReleased?.takeIf { it.isNotEmpty() }?.let { slots ->
                item(key = "recent-h") { SectionHeader("Estrenos recientes", subtitle = "Episodios emitidos en los últimos 7 días", index = 5) }
                item(key = "recent") {
                    LazyRow(contentPadding = PaddingValues(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        items(slots, key = { "rr-${it.anime.id}" }) { s ->
                            WideEpisodeCard(s.anime, "EP ${s.episode} · ${ago(s.airingAt)}", onClick = { onOpenAnime(s.anime, null) })
                        }
                    }
                }
            }
            animeRail("top", "Mejor valorados", data?.highestRated?.take(10), onOpenAnime, index = 6, ranked = true)
            animeRail("gems", "Joyas ocultas", data?.hiddenGems, onOpenAnime, subtitle = "Amados por quienes los descubrieron", index = 7)
            animeRail("upcoming", "Próximos estrenos", data?.upcoming, onOpenAnime, subtitle = "Próxima temporada", index = 8,
                captionFor = { it.seasonLabel ?: "Próximamente" })
            favGenre?.let { animeRail("genre", it.title, it.items, onOpenAnime, subtitle = it.subtitle, index = 9, onSeeAll = { onSeeAll(it.title.removePrefix("Because you love ")) }) }
            item(key = "friends") { friendsSection() }
            because?.let { animeRail("because", it.title, it.items, onOpenAnime, subtitle = it.subtitle, index = 11) }
            animeRail("favs", "Favoritos de la comunidad", data?.communityFavorites, onOpenAnime, subtitle = "Los más favoritos de todos los tiempos", index = 12)
            if (data != null) item(key = "attribution") {
                Text(
                    "Datos del catálogo de AniList · " + if (data.fromCache) "copia guardada" else "en vivo",
                    style = Kaze.type.bodySmall, color = Kaze.colors.textMuted,
                    modifier = Modifier.padding(20.dp).windowInsetsPadding(WindowInsets.navigationBars),
                )
            }
        }

        HomeTopBar(onSearch, onNotifications, solid = { listState.firstVisibleItemIndex > 0 || listState.firstVisibleItemScrollOffset > 600 })
    }
}

@Composable
private fun PersonalizeHint() {
    Column(Modifier.padding(horizontal = 20.dp)) {
        SectionHeader("Recomendado para ti", index = 4)
        Text(
            "Agrega o califica animes para que KAZE personalice tus recomendaciones según tus gustos.",
            style = Kaze.type.body, color = Kaze.colors.textMuted, modifier = Modifier.padding(horizontal = 20.dp),
        )
    }
}

@Composable
private fun HomeTopBar(onSearch: () -> Unit, onNotifications: () -> Unit, solid: () -> Boolean) {
    val c = Kaze.colors
    val isSolid by remember { derivedStateOf(solid) }
    Row(
        Modifier
            .fillMaxWidth()
            .background(if (isSolid) c.background.copy(alpha = 0.94f) else Color.Transparent)
            .windowInsetsPadding(WindowInsets.statusBars)
            .padding(horizontal = 16.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "KAZE",
            style = Kaze.type.headline.copy(fontWeight = FontWeight.Black),
            color = if (Kaze.style.ornament == Ornament.EDITORIAL) c.text else c.primary,
            modifier = Modifier.semantics { heading() },
        )
        Text(" 風", style = Kaze.type.title, color = c.accent)
        Spacer(Modifier.weight(1f))
        KazeIconButton(Icons.Filled.Search, "Buscar anime", onSearch, background = c.scrim.copy(alpha = 0.4f))
        Spacer(Modifier.width(6.dp))
        KazeIconButton(Icons.Filled.Notifications, "Notifications", onNotifications, background = c.scrim.copy(alpha = 0.4f))
    }
}

/** Signature interaction #1 — cinematic hero: parallax art, theme-specific title choreography, auto-advance. */
@Composable
private fun HeroCarousel(
    items: List<Anime>,
    inLibrary: (Int) -> Boolean,
    onOpen: (Anime) -> Unit,
    onWatch: (Anime) -> Unit,
    onToggleList: (Anime) -> Unit,
    onTrailer: (Anime) -> Unit,
    scrollOffset: () -> Int,
) {
    val pager = rememberPagerState { items.size }
    val reduced = Kaze.reducedMotion
    val motion = Kaze.style.motion
    LaunchedEffect(pager, reduced) {
        if (reduced) return@LaunchedEffect
        while (true) {
            delay(7_000)
            if (!pager.isScrollInProgress) pager.animateScrollToPage((pager.currentPage + 1) % items.size)
        }
    }
    val c = Kaze.colors
    Box(Modifier.fillMaxWidth().height(560.dp).clipToBounds()) {
        HorizontalPager(pager, Modifier.fillMaxSize(), key = { items[it].id }) { page ->
            val a = items[page]
            Box(
                Modifier.fillMaxSize().clickable(onClickLabel = "Open ${a.displayTitle}") { onOpen(a) }
            ) {
                AnimeImage(
                    a.coverUrl, null,
                    Modifier.fillMaxSize().graphicsLayer {
                        val offset = pager.pageOffset(page)
                        translationX = offset * size.width * 0.35f
                        translationY = scrollOffset() * 0.4f
                        val s = 1.08f - (offset.absoluteValue * 0.04f)
                        scaleX = s; scaleY = s
                    },
                    placeholderColor = parseHexColor(a.color),
                )
            }
        }
        // Atmospheric overlays: a theme-coloured haze plus a strong bottom fade for legible text.
        // Light themes put dark text on pale haze, which busy artwork overwhelms sooner, so their scrims are denser.
        val haze = if (c.isLight) 0.8f else 0.55f
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(c.background.copy(alpha = haze), Color.Transparent, Color.Transparent))))
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0.25f to Color.Transparent, 0.5f to c.background.copy(alpha = if (c.isLight) 0.82f else 0.6f), 0.75f to c.background.copy(alpha = 0.94f), 1f to c.background)))
        if (Kaze.style.ornament == Ornament.GLOW) Box(Modifier.fillMaxSize().background(Brush.radialGradient(listOf(c.primary.copy(alpha = 0.25f), Color.Transparent), radius = 900f)))

        val current = items.getOrNull(pager.currentPage) ?: return@Box
        Column(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp)) {
            AnimatedContent(
                targetState = current,
                transitionSpec = {
                    if (reduced) fadeIn(tween(0)) togetherWith fadeOut(tween(0))
                    else when (motion) {
                        MotionPersonality.DIRECTIONAL -> (slideInHorizontally(tween(260)) { it / 3 } + fadeIn(tween(200))) togetherWith fadeOut(tween(120))
                        MotionPersonality.MINIMAL -> fadeIn(tween(420)) togetherWith fadeOut(tween(200))
                        else -> (slideInVertically(spring(0.8f, Spring.StiffnessLow)) { it / 2 } + fadeIn(tween(260))) togetherWith fadeOut(tween(160))
                    }
                },
                label = "hero-title",
            ) { a ->
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "#${items.indexOf(a) + 1} TRENDING" + (a.seasonLabel?.let { "  ·  $it" } ?: ""),
                        style = Kaze.type.overline, color = c.accentText,
                    )
                    Text(
                        a.displayTitle,
                        style = Kaze.type.display,
                        color = c.text,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.semantics { heading() },
                    )
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        ScoreBadge(a.score)
                        Text(listOfNotNull(a.formatLabel, a.episodes?.let { "$it episodes" }, a.studios.firstOrNull()).joinToString("  ·  "), style = Kaze.type.bodySmall, color = c.textMuted, maxLines = 1)
                    }
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp), maxLines = 1) {
                        a.genres.take(3).forEach { KazeChip(it) }
                    }
                    val synopsis = remember(a.id) { SafeRichText.htmlToPlain(a.description) }
                    if (synopsis.isNotEmpty()) Text(synopsis, style = Kaze.type.bodySmall, color = c.text.copy(alpha = 0.82f), maxLines = 3, overflow = TextOverflow.Ellipsis)
                }
            }
            Spacer(Modifier.height(14.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                KazeButton("Ver", { onWatch(current) }, icon = Icons.Filled.PlayArrow, modifier = Modifier.weight(1f))
                val listed = inLibrary(current.id)
                KazeButton(if (listed) "In list" else "My list", { onToggleList(current) }, icon = if (listed) Icons.Filled.Check else Icons.Filled.Add, kind = KazeButtonKind.Secondary)
                if (current.trailer?.url != null) KazeIconButton(Icons.Filled.Theaters, "Ver tráiler", { onTrailer(current) }, background = c.surfaceHigh)
            }
            Spacer(Modifier.height(14.dp))
            PagerDots(pager, items.size)
        }
    }
}

@Composable
private fun PagerDots(pager: PagerState, count: Int) {
    val c = Kaze.colors
    Row(
        Modifier.fillMaxWidth().semantics { contentDescription = "Featured ${pager.currentPage + 1} of $count" },
        horizontalArrangement = Arrangement.Center,
    ) {
        repeat(count) { i ->
            val selected = pager.currentPage == i
            val w by animateDpAsState(if (selected) 22.dp else 6.dp, spring(0.7f, Spring.StiffnessMediumLow), label = "dot")
            Box(
                Modifier.padding(horizontal = 3.dp).height(6.dp).width(w).clip(CircleShape)
                    .background(if (selected) c.primary else c.text.copy(alpha = 0.3f))
            )
        }
    }
}

private fun PagerState.pageOffset(page: Int): Float = (currentPage - page) + currentPageOffsetFraction

private fun remaining(ms: Long): String {
    val m = TimeUnit.MILLISECONDS.toMinutes(ms.coerceAtLeast(0))
    return if (m < 1) "<1 min" else "$m min"
}

private fun ago(epochSec: Long): String {
    val diff = System.currentTimeMillis() / 1000 - epochSec
    return when {
        diff < 3600 -> "${(diff / 60).coerceAtLeast(1)}m ago"
        diff < 86_400 -> "${diff / 3600}h ago"
        else -> "${diff / 86_400}d ago"
    }
}
