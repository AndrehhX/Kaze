package com.kaze.mobile.feature.profile

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Insights
import androidx.compose.material.icons.filled.Settings
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.kaze.mobile.core.designsystem.components.AnimeImage
import com.kaze.mobile.core.designsystem.components.EmptyState
import com.kaze.mobile.core.designsystem.components.KazeButton
import com.kaze.mobile.core.designsystem.components.KazeButtonKind
import com.kaze.mobile.core.designsystem.components.KazeCard
import com.kaze.mobile.core.designsystem.components.KazeChip
import com.kaze.mobile.core.designsystem.components.KazeIconButton
import com.kaze.mobile.core.designsystem.components.KazeTopBar
import com.kaze.mobile.core.designsystem.components.ProgressLine
import com.kaze.mobile.core.designsystem.components.SectionHeader
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.core.designsystem.theme.KazePalettes
import com.kaze.mobile.core.designsystem.theme.KazeThemeId
import com.kaze.mobile.data.library.AchievementProgress
import com.kaze.mobile.domain.model.AniListCatalog
import com.kaze.mobile.domain.model.Anime
import com.kaze.mobile.domain.model.LibraryStatus
import com.kaze.mobile.feature.library.DnaContent
import com.kaze.mobile.feature.library.Field
import com.kaze.mobile.ui.components.PosterCard
import java.text.DateFormat
import java.util.Date

/** Identity shown in the header — local guest data or a signed-in backend profile. */
data class ProfileIdentity(
    val displayName: String,
    val username: String?,
    val bio: String,
    val avatarUrl: String?,
    val bannerUrl: String?,
    val theme: KazeThemeId?,
    val isGuest: Boolean,
)

@Composable
fun ProfileScreen(
    identity: ProfileIdentity?,
    onSettings: () -> Unit,
    onEdit: () -> Unit,
    onAchievements: () -> Unit,
    onStats: () -> Unit,
    onFriends: (() -> Unit)?,
    onOpenAnime: (Int) -> Unit,
    accountCard: @Composable () -> Unit,
    vm: ProfileViewModel = hiltViewModel(),
) {
    val prefs by vm.prefs.collectAsStateWithLifecycle()
    val library by vm.library.collectAsStateWithLifecycle()
    val dna by vm.dna.collectAsStateWithLifecycle()
    val achievements by vm.achievements.collectAsStateWithLifecycle()
    val activity by vm.activity.collectAsStateWithLifecycle()
    val c = Kaze.colors
    val p = prefs ?: return
    val id = identity ?: ProfileIdentity(p.localDisplayName.ifBlank { "Guest" }, null, p.localBio, null, null, p.profileTheme, isGuest = true)

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 120.dp)) {
        item(key = "header") { ProfileHeader(id, onSettings, onEdit, stats = listOf(
            "Animes" to library.size, "Completados" to library.count { it.status == LibraryStatus.COMPLETED },
            "Episodios" to library.sumOf { it.progress }, "Favoritos" to library.count { it.isFavorite },
        )) }
        item(key = "account") { accountCard() }
        item(key = "actions") {
            Row(Modifier.padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                KazeChip("Estadísticas", icon = Icons.Filled.Insights, onClick = onStats)
                if (p.gamificationEnabled) KazeChip("Logros ${achievements.count { it.unlockedAt != null }}/${achievements.size}", icon = Icons.Filled.EmojiEvents, onClick = onAchievements)
                onFriends?.let { KazeChip("Amigos", icon = Icons.Filled.Group, onClick = it) }
            }
        }
        val favs = library.filter { it.isFavorite }
        if (favs.isNotEmpty()) {
            item(key = "favs-h") { SectionHeader("Animes favoritos") }
            item(key = "favs") {
                LazyRow(contentPadding = PaddingValues(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    items(favs, key = { it.animeId }) { e ->
                        PosterCard(Anime(id = e.animeId, title = e.title, coverUrl = e.coverUrl, color = e.color, score = e.userScore), { onOpenAnime(e.animeId) }, width = 110.dp)
                    }
                }
            }
        }
        val genres = dna?.genreShare.orEmpty()
        item(key = "genres-h") { SectionHeader("Géneros favoritos", subtitle = if (genres.isEmpty()) "De tus preferencias" else "De tu biblioteca") }
        item(key = "genres") {
            FlowRow(Modifier.padding(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                (genres.map { it.first }.ifEmpty { p.favoriteGenres.toList() }).take(8).forEach { KazeChip(it) }
                if (genres.isEmpty() && p.favoriteGenres.isEmpty()) Text("Sin géneros aún.", style = Kaze.type.bodySmall, color = c.textMuted)
            }
        }
        dna?.takeIf { it.totalTitles > 0 }?.let { d ->
            item(key = "dna") {
                KazeCard(Modifier.fillMaxWidth().padding(16.dp), onClick = onStats, onClickLabel = "Open statistics") {
                    Column {
                        Text("ANIME DNA", style = Kaze.type.overline, color = c.accentText)
                        Text(d.archetype, style = Kaze.type.headline, color = c.text)
                        Text("${d.completed} completed · avg score ${d.averageScore?.let { "%.0f".format(it) } ?: "—"} · ~${d.estimatedHours}h estimated", style = Kaze.type.bodySmall, color = c.textMuted)
                    }
                }
            }
        }
        if (p.gamificationEnabled && achievements.any { it.unlockedAt != null }) {
            item(key = "ach-h") { SectionHeader("Achievements", onSeeAll = onAchievements) }
            item(key = "ach") {
                LazyRow(contentPadding = PaddingValues(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(achievements.filter { it.unlockedAt != null }, key = { it.def.id }) { AchievementBadge(it) }
                }
            }
        }
        item(key = "activity-h") { SectionHeader("Actividad reciente", subtitle = "Privado — en este dispositivo") }
        if (activity.isEmpty()) item(key = "activity-empty") {
            Text("Add, rate or finish an anime and it will show up here.", style = Kaze.type.body, color = c.textMuted, modifier = Modifier.padding(horizontal = 20.dp))
        }
        items(activity.take(15), key = { "act-${it.id}" }) { e ->
            Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(8.dp).clip(CircleShape).background(c.primary))
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(describe(e.type, e.title, e.detail), style = Kaze.type.body, color = c.text, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Text(DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT).format(Date(e.createdAt)), style = Kaze.type.bodySmall, color = c.textMuted)
                }
            }
        }
    }
}

private fun describe(type: String, title: String?, detail: String?): String = when (type) {
    "added" -> "Agregó ${title ?: "un anime"} a ${detail ?: "la biblioteca"}"
    "completed" -> "Completó ${title ?: "un anime"}"
    "progress" -> "Vio ${detail ?: "un episodio"} de ${title ?: "un anime"}"
    "rated" -> "Calificó ${title ?: "un anime"} ${detail ?: ""}"
    "favorited" -> "Marcó como favorito ${title ?: "un anime"}"
    "review_posted" -> "Escribió una reseña de ${title ?: "un anime"}"
    "party_hosted" -> "Inició una watch party de ${title ?: "un anime"}"
    else -> title ?: type
}

/** Signature interaction #5 — profile reveal: banner sweep, avatar spring, count-up stats. */
@Composable
private fun ProfileHeader(id: ProfileIdentity, onSettings: () -> Unit, onEdit: () -> Unit, stats: List<Pair<String, Int>>) {
    val c = Kaze.colors
    val accent = id.theme?.let { KazePalettes.of(it) } ?: c
    val reveal = remember { Animatable(0f) }
    val avatar = remember { Animatable(0.4f) }
    val reduced = Kaze.reducedMotion
    LaunchedEffect(Unit) {
        if (reduced) { reveal.snapTo(1f); avatar.snapTo(1f) } else {
            reveal.animateTo(1f, tween(700))
        }
    }
    LaunchedEffect(Unit) { if (!reduced) avatar.animateTo(1f, spring(0.45f, Spring.StiffnessLow)) }
    Box {
        Box(
            Modifier.fillMaxWidth().height(200.dp)
                .graphicsLayer { alpha = reveal.value }
                .background(Brush.linearGradient(listOf(accent.primary, accent.secondary, accent.accent.copy(alpha = 0.6f))))
        ) {
            if (id.bannerUrl != null) AnimeImage(id.bannerUrl, null, Modifier.fillMaxSize())
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, c.background))))
        }
        Row(Modifier.fillMaxWidth().padding(top = 32.dp, end = 8.dp), horizontalArrangement = Arrangement.End) {
            KazeIconButton(Icons.Filled.Edit, "Edit profile", onEdit, background = c.scrim.copy(alpha = 0.5f))
            KazeIconButton(Icons.Filled.Settings, "Ajustes", onSettings, background = c.scrim.copy(alpha = 0.5f))
        }
        Column(Modifier.padding(top = 140.dp).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                Modifier.size(104.dp).graphicsLayer { scaleX = avatar.value; scaleY = avatar.value }
                    .clip(CircleShape).background(Brush.linearGradient(listOf(accent.primary, accent.accent)))
                    .border(4.dp, c.background, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                if (id.avatarUrl != null) AnimeImage(id.avatarUrl, "Avatar", Modifier.fillMaxSize())
                else Text(id.displayName.take(1).uppercase(), style = Kaze.type.display, color = Color.White)
            }
            Spacer(Modifier.height(10.dp))
            Text(id.displayName, style = Kaze.type.headline, color = c.text, modifier = Modifier.semantics { heading() }.graphicsLayer { translationY = (1 - reveal.value) * 30f; alpha = reveal.value })
            id.username?.let { Text("@$it", style = Kaze.type.bodySmall, color = c.textMuted) }
            if (id.isGuest) Text("Guest profile · stored on this device", style = Kaze.type.bodySmall, color = c.textMuted)
            if (id.bio.isNotBlank()) Text(id.bio, style = Kaze.type.body, color = c.text, textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 32.dp, vertical = 6.dp))
            Spacer(Modifier.height(12.dp))
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
                stats.forEach { (label, value) -> CountUpStat(label, value) }
            }
            Spacer(Modifier.height(12.dp))
        }
    }
}

@Composable
private fun CountUpStat(label: String, value: Int) {
    val anim = remember { Animatable(0f) }
    val reduced = Kaze.reducedMotion
    LaunchedEffect(value) { if (reduced) anim.snapTo(value.toFloat()) else anim.animateTo(value.toFloat(), tween(900)) }
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.semantics(mergeDescendants = true) { contentDescription = "$value $label" }) {
        Text("${anim.value.toInt()}", style = Kaze.type.headline, color = Kaze.colors.text)
        Text(label, style = Kaze.type.bodySmall, color = Kaze.colors.textMuted)
    }
}

@Composable
fun AchievementBadge(a: AchievementProgress, modifier: Modifier = Modifier) {
    val c = Kaze.colors
    val unlocked = a.unlockedAt != null
    KazeCard(modifier.width(150.dp), highlighted = unlocked, padding = PaddingValues(12.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(a.def.glyph, style = Kaze.type.headline, color = if (unlocked) c.accent else c.textMuted)
            Text(a.def.title, style = Kaze.type.titleSmall, color = c.text)
            Text(a.def.description, style = Kaze.type.bodySmall, color = c.textMuted, maxLines = 2, overflow = TextOverflow.Ellipsis)
            ProgressLine(a.progress.toFloat() / a.def.target)
            Text(if (unlocked) "Unlocked" else "${a.progress}/${a.def.target}", style = Kaze.type.overline, color = if (unlocked) c.success else c.textMuted)
        }
    }
}

@Composable
fun AchievementsScreen(onBack: () -> Unit, vm: ProfileViewModel = hiltViewModel()) {
    val achievements by vm.achievements.collectAsStateWithLifecycle()
    Column(Modifier.fillMaxSize()) {
        KazeTopBar("Achievements", onBack, subtitle = "Earned only from things you actually do")
        FlowRow(
            Modifier.verticalScroll(rememberScrollState()).padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp),
        ) { achievements.forEach { AchievementBadge(it) } }
    }
}

@Composable
fun ProfileStatsScreen(onBack: () -> Unit, vm: ProfileViewModel = hiltViewModel()) {
    val dna by vm.dna.collectAsStateWithLifecycle()
    val ms by vm.demoWatchMs.collectAsStateWithLifecycle()
    Column(Modifier.fillMaxSize()) {
        KazeTopBar("Profile statistics", onBack)
        val d = dna
        if (d == null || d.totalTitles == 0) EmptyState("No statistics yet", "Statistics come from your library. Add some anime first.")
        else DnaContent(d, ms)
    }
}

/** Local (guest) profile editor. Signed-in users edit their backend profile instead. */
@Composable
fun EditLocalProfileScreen(onBack: () -> Unit, vm: ProfileViewModel = hiltViewModel()) {
    val prefs by vm.prefs.collectAsStateWithLifecycle()
    val p = prefs ?: return
    var name by rememberSaveable { mutableStateOf(p.localDisplayName) }
    var bio by rememberSaveable { mutableStateOf(p.localBio) }
    var theme by rememberSaveable { mutableStateOf(p.profileTheme) }
    var genres by rememberSaveable { mutableStateOf(p.favoriteGenres) }
    val c = Kaze.colors
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        KazeTopBar("Edit profile", onBack, subtitle = "Guest profile — stays on this device")
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Field("Display name", name, { name = it.take(40) })
            Field("Bio", bio, { bio = it.take(300) }, singleLine = false)
            Text("Profile theme", style = Kaze.type.title, color = c.text)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                KazeChip("Match app", selected = theme == null, onClick = { theme = null })
                KazeThemeId.entries.forEach { t -> KazeChip(t.label, selected = theme == t, onClick = { theme = t }) }
            }
            Text("Favourite genres", style = Kaze.type.title, color = c.text)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                AniListCatalog.genres.forEach { g -> KazeChip(g, selected = g in genres, onClick = { genres = if (g in genres) genres - g else genres + g }) }
            }
            KazeButton("Save", { vm.saveLocal(name, bio, theme); vm.setFavoriteGenres(genres); onBack() }, modifier = Modifier.fillMaxWidth())
            KazeButton("Cancel", onBack, kind = KazeButtonKind.Ghost, modifier = Modifier.fillMaxWidth())
        }
    }
}
