package com.kaze.mobile.feature.party

import android.content.Intent
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Forward10
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Replay10
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Theaters
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
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
import com.kaze.mobile.core.designsystem.components.Pill
import com.kaze.mobile.core.designsystem.components.SectionHeader
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.data.backend.ConnectionState
import com.kaze.mobile.data.backend.Reaction
import com.kaze.mobile.domain.party.PartyReactions
import com.kaze.mobile.domain.social.Party
import com.kaze.mobile.feature.auth.AuthField
import com.kaze.mobile.feature.auth.BackendNotConfiguredCard
import com.kaze.mobile.feature.player.FitMode
import com.kaze.mobile.feature.player.KazeVideoSurface
import com.kaze.mobile.feature.player.formatTime
import com.kaze.mobile.feature.social.Avatar
import kotlin.random.Random

@Composable
fun WatchPartiesScreen(onBack: () -> Unit, onOpenRoom: (code: String, animeId: Int, title: String, cover: String?) -> Unit, configured: Boolean, vm: PartiesViewModel = hiltViewModel()) {
    val library by vm.library.collectAsStateWithLifecycle()
    val parties by vm.parties.collectAsStateWithLifecycle()
    val busy by vm.busy.collectAsStateWithLifecycle()
    val error by vm.error.collectAsStateWithLifecycle()
    var code by rememberSaveable { mutableStateOf("") }
    var picked by rememberSaveable { mutableIntStateOf(vm.preselect.animeId) }
    var episode by rememberSaveable { mutableIntStateOf(1) }
    LaunchedEffect(Unit) { vm.open.collect { p -> onOpenRoom(p.code, p.animeId, p.animeTitle, p.animeCover) } }
    val c = Kaze.colors
    val choices = buildList {
        if (vm.preselect.animeId > 0) add(Triple(vm.preselect.animeId, vm.preselect.title, vm.preselect.cover))
        library.filterNot { it.animeId == vm.preselect.animeId }.take(20).forEach { add(Triple(it.animeId, it.title, it.coverUrl)) }
    }
    val chosen = choices.firstOrNull { it.first == picked }
    Column(Modifier.fillMaxSize().imePadding().verticalScroll(rememberScrollState())) {
        KazeTopBar("Salas compartidas", onBack, subtitle = "Synchronized rooms with chat and reactions")
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            KazeCard(Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("How it works", style = Kaze.type.overline, color = c.accentText)
                    Text("The server keeps the authoritative play/pause/position. Every member's own player streams media independently and continuously corrects clock drift — video is never relayed between phones.", style = Kaze.type.bodySmall, color = c.text)
                }
            }
            if (!vm.available) {
                if (!configured) BackendNotConfiguredCard() else Text("Inicia sesión para crear o unirte a salas con amigos.", style = Kaze.type.body, color = c.textMuted)
            } else {
                SectionHeader("Unirse con un código", modifier = Modifier.padding(start = 0.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.weight(1f)) { AuthField("Código de sala", code, { code = it.uppercase().filter { ch -> ch.isLetterOrDigit() }.take(6) }) }
                    Spacer(Modifier.width(8.dp))
                    KazeButton("Join", { vm.join(code) }, enabled = code.length == 6, loading = busy)
                }
            }
            SectionHeader("Crear una sala", modifier = Modifier.padding(start = 0.dp))
            if (choices.isEmpty()) Text("Añade un anime a tu biblioteca o toca «Ver juntos» en su página para elegir qué ver.", style = Kaze.type.bodySmall, color = c.textMuted)
            LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                items(choices, key = { it.first }) { (id, title, cover) ->
                    Column(
                        Modifier.width(96.dp).clickable(role = Role.RadioButton, onClickLabel = "Choose $title") { picked = id; episode = 1 },
                    ) {
                        Box(Modifier.fillMaxWidth().aspectRatio(0.7f).clip(Kaze.style.posterShape).background(if (picked == id) c.primary else c.surfaceHigh).padding(if (picked == id) 3.dp else 0.dp).clip(Kaze.style.posterShape)) {
                            AnimeImage(cover, null, Modifier.fillMaxSize())
                        }
                        Text(title, style = Kaze.type.bodySmall, color = if (picked == id) c.primary else c.text, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
            if (chosen != null) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Episodio", style = Kaze.type.body, color = c.text)
                    KazeChip("−", onClick = { episode = (episode - 1).coerceAtLeast(1) })
                    Text("$episode", style = Kaze.type.title, color = c.text)
                    KazeChip("+", onClick = { episode++ })
                }
                if (vm.available) KazeButton("Crear sala para ${chosen.second}", { vm.create(chosen.first, chosen.second, chosen.third, episode) }, icon = Icons.Filled.Theaters, loading = busy, modifier = Modifier.fillMaxWidth())
                KazeButton("Probar una sala local", { onOpenRoom(PartyRoomViewModel.LOCAL_CODE, chosen.first, chosen.second, chosen.third) }, kind = KazeButtonKind.Secondary, modifier = Modifier.fillMaxWidth())
            }
            error?.let { Text(it, color = c.error, style = Kaze.type.bodySmall) }
            if (parties.isNotEmpty()) {
                SectionHeader("Your active rooms", modifier = Modifier.padding(start = 0.dp))
                parties.forEach { p -> PartyRow(p) { onOpenRoom(p.code, p.animeId, p.animeTitle, p.animeCover) } }
            }
        }
    }
}

@Composable
private fun PartyRow(p: Party, onClick: () -> Unit) {
    KazeCard(Modifier.fillMaxWidth(), onClick = onClick, onClickLabel = "Open room ${p.code}") {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(44.dp, 62.dp).clip(Kaze.style.posterShape)) { AnimeImage(p.animeCover, null, Modifier.fillMaxSize()) }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(p.animeTitle, style = Kaze.type.titleSmall, color = Kaze.colors.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("Room ${p.code} · EP ${p.episode} · ${if (p.isPlaying) "playing" else "paused"}", style = Kaze.type.bodySmall, color = Kaze.colors.textMuted)
            }
        }
    }
}

@Composable
fun WatchPartyRoomScreen(onBack: () -> Unit, vm: PartyRoomViewModel = hiltViewModel()) {
    val ui by vm.ui.collectAsStateWithLifecycle()
    val party by vm.party.collectAsStateWithLifecycle()
    val transport by vm.transport.collectAsStateWithLifecycle()
    val messages by vm.messages.collectAsStateWithLifecycle()
    val members by vm.members.collectAsStateWithLifecycle()
    val online by vm.online.collectAsStateWithLifecycle()
    val reactions by vm.reactions.collectAsStateWithLifecycle()
    val connection by vm.connection.collectAsStateWithLifecycle()
    val friends by vm.friends.collectAsStateWithLifecycle()
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var draft by rememberSaveable { mutableStateOf("") }
    var inviting by rememberSaveable { mutableStateOf(false) }
    val snackbar = remember { SnackbarHostState() }
    val context = LocalContext.current
    LaunchedEffect(Unit) { vm.toasts.collect { snackbar.showSnackbar(it) } }
    val c = Kaze.colors
    val isHost = party?.hostId != null && party?.hostId == transport?.myUserId

    Box(Modifier.fillMaxSize().imePadding()) {
        Column(Modifier.fillMaxSize()) {
            KazeTopBar(
                title = party?.let { "Room ${it.code}" } ?: "Watch party",
                onBack = onBack,
                subtitle = party?.let { "${it.animeTitle} · EP ${it.episode}" },
                actions = {
                    if (transport?.isDemo == false) {
                        KazeIconButton(Icons.Filled.PersonAdd, "Invite friends", { inviting = true })
                        KazeIconButton(Icons.Filled.Share, "Compartir enlace de sala", {
                            party?.let { p ->
                                val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, "Watch ${p.animeTitle} with me on KAZE: kaze://party/${p.code} (code ${p.code})")
                                context.startActivity(Intent.createChooser(send, "Compartir sala").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                            }
                        })
                    }
                    KazeIconButton(Icons.AutoMirrored.Filled.ExitToApp, "Salir de la sala", { vm.leave(onBack) })
                },
            )
            when {
                ui.loading -> { Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { KazeSpinner() }; return@Column }
                ui.error != null && party == null -> { ErrorState(ui.error!!); return@Column }
                ui.ended -> { EmptyState("Esta sala ha finalizado", "The host closed it or it expired after 6 hours."); return@Column }
            }
            if (transport?.isDemo == true) Text("Local demo — not connected to anyone. The sync engine runs against an in-memory server.", style = Kaze.type.bodySmall, color = c.warning, modifier = Modifier.background(c.warning.copy(alpha = 0.12f)).fillMaxWidth().padding(10.dp))
            if (connection == ConnectionState.RECONNECTING) Text("Connection lost — reconnecting and resyncing…", style = Kaze.type.bodySmall, color = c.text, modifier = Modifier.background(c.error.copy(alpha = 0.2f)).fillMaxWidth().padding(10.dp).semantics { liveRegion = LiveRegionMode.Polite })

            Box(Modifier.fillMaxWidth().aspectRatio(16f / 9f).background(Color.Black)) {
                KazeVideoSurface(vm.player, ui.videoAspect, FitMode.FIT, 1f, true, Modifier.fillMaxSize())
                if (ui.buffering) KazeSpinner(Modifier.align(Alignment.Center).size(40.dp), color = Color.White)
                FloatingReactions(reactions, Modifier.fillMaxSize())
                Pill(
                    when {
                        kotlin.math.abs(ui.driftMs) < 300 -> "In sync"
                        kotlin.math.abs(ui.driftMs) < 1500 -> "Catching up ${ui.driftMs}ms"
                        else -> "Resyncing…"
                    },
                    Modifier.align(Alignment.TopEnd).padding(8.dp),
                    color = if (kotlin.math.abs(ui.driftMs) < 300) c.success else c.warning,
                )
            }
            Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("${formatTime(ui.positionMs)} / ${formatTime(ui.durationMs)}", style = Kaze.type.label, color = c.text, modifier = Modifier.padding(start = 8.dp))
                Spacer(Modifier.weight(1f))
                if (isHost) {
                    KazeIconButton(Icons.Filled.Replay10, "Rewind 10 seconds for everyone", { vm.seekBy(-10_000) })
                    KazeIconButton(if (ui.isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow, if (ui.isPlaying) "Pause for everyone" else "Play for everyone", vm::togglePlay, background = c.primary.copy(alpha = 0.2f))
                    KazeIconButton(Icons.Filled.Forward10, "Forward 10 seconds for everyone", { vm.seekBy(10_000) })
                    KazeIconButton(Icons.Filled.SkipNext, "Siguiente episodio para todos", vm::nextEpisode)
                } else Text("The host controls playback", style = Kaze.type.bodySmall, color = c.textMuted, modifier = Modifier.padding(12.dp))
            }
            ui.source?.demoNotice?.let { Text(it, style = Kaze.type.overline, color = c.textMuted, modifier = Modifier.padding(horizontal = 16.dp), maxLines = 2) }
            LazyRow(contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                items(PartyReactions.palette) { e ->
                    Box(Modifier.size(44.dp).clip(CircleShape).background(c.surfaceHigh).clickable(role = Role.Button, onClickLabel = "React $e") { vm.react(e) }, contentAlignment = Alignment.Center) { Text(e, fontSize = 22.sp) }
                }
            }
            Row(Modifier.padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                KazeChip("Chat ${messages.count { it.kind == "chat" }}", selected = tab == 0, onClick = { tab = 0 })
                KazeChip("People ${members.size}", selected = tab == 1, onClick = { tab = 1 })
            }
            if (tab == 0) {
                val listState = rememberLazyListState()
                LaunchedEffect(messages.size) { if (messages.isNotEmpty()) listState.animateScrollToItem(messages.lastIndex) }
                LazyColumn(Modifier.weight(1f), state = listState, contentPadding = PaddingValues(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(messages, key = { it.id }) { m ->
                        val mine = m.userId == transport?.myUserId
                        val author = members.firstOrNull { it.userId == m.userId }?.profile
                        Column(Modifier.fillMaxWidth(), horizontalAlignment = if (mine) Alignment.End else Alignment.Start) {
                            if (m.kind == "system") Text(m.body, style = Kaze.type.bodySmall, color = c.textMuted)
                            else {
                                if (!mine) Text(author?.name ?: "Member", style = Kaze.type.overline, color = c.primary)
                                Text(m.body, style = Kaze.type.body, color = if (mine) c.onPrimary else c.text, modifier = Modifier.clip(Kaze.style.chipShape).background(if (mine) c.primary else c.surfaceHigh).padding(horizontal = 12.dp, vertical = 8.dp))
                            }
                        }
                    }
                }
                Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.weight(1f)) { AuthField("Message", draft, { draft = it.take(500) }) }
                    KazeIconButton(Icons.AutoMirrored.Filled.Send, "Send message", { vm.sendChat(draft); draft = "" }, enabled = draft.isNotBlank(), tint = c.primary)
                }
            } else {
                LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(12.dp)) {
                    items(members, key = { it.userId }) { m ->
                        Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box { Avatar(m.profile, 40); if (m.userId in online) Box(Modifier.align(Alignment.BottomEnd).size(12.dp).clip(CircleShape).background(c.success)) }
                            Spacer(Modifier.width(12.dp))
                            Text(m.profile?.name ?: "Member", style = Kaze.type.body, color = c.text, modifier = Modifier.weight(1f))
                            if (m.userId == party?.hostId) Row(verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Filled.Star, null, tint = c.accent, modifier = Modifier.size(16.dp)); Text(" Host", style = Kaze.type.label, color = c.accent) }
                        }
                    }
                }
            }
        }
        SnackbarHost(snackbar, Modifier.align(Alignment.TopCenter).padding(top = 80.dp))
    }

    if (inviting) ModalBottomSheet({ inviting = false }, containerColor = c.surface, shape = Kaze.style.sheetShape) {
        Column(Modifier.padding(20.dp).padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Invite friends", style = Kaze.type.title, color = c.text)
            if (friends.isEmpty()) Text("Add friends first — invites are friends-only.", style = Kaze.type.bodySmall, color = c.textMuted)
            friends.forEach { f ->
                Row(Modifier.fillMaxWidth().clickable(role = Role.Button, onClickLabel = "Invite ${f.name}") { vm.invite(f) }.padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Avatar(f, 36); Spacer(Modifier.width(10.dp)); Text(f.name, style = Kaze.type.body, color = c.text, modifier = Modifier.weight(1f)); Icon(Icons.Filled.PersonAdd, null, tint = c.primary)
                }
            }
        }
    }
}

/** Signature interaction #10 — reactions float up from random lanes and fade; drawn in graphicsLayer only. */
@Composable
private fun FloatingReactions(reactions: List<Reaction>, modifier: Modifier) {
    val reduced = Kaze.reducedMotion
    BoxWithConstraints(modifier) {
        val h = maxHeight
        reactions.takeLast(12).forEach { r ->
            key(r.id) {
                val progress = remember { Animatable(0f) }
                val lane = remember { Random(r.id.hashCode()).nextFloat() }
                LaunchedEffect(Unit) { progress.animateTo(1f, tween(if (reduced) 600 else 2_400, easing = LinearEasing)) }
                Text(
                    r.emoji, fontSize = 28.sp,
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .offset(x = maxWidth * (0.55f + lane * 0.4f))
                        .graphicsLayer {
                            translationY = if (reduced) 0f else -progress.value * h.toPx() * 0.8f
                            translationX = if (reduced) 0f else kotlin.math.sin(progress.value * 6f + lane * 6f) * 18f
                            alpha = 1f - progress.value
                            val s = 0.8f + 0.4f * (1f - progress.value)
                            scaleX = s; scaleY = s
                        },
                )
            }
        }
    }
}
