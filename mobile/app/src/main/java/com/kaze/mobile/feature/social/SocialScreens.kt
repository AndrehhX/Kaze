package com.kaze.mobile.feature.social

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.PersonRemove
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
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
import com.kaze.mobile.core.designsystem.components.SectionHeader
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.core.designsystem.theme.KazePalettes
import com.kaze.mobile.core.designsystem.theme.KazeThemeId
import com.kaze.mobile.data.backend.parseIsoMillis
import com.kaze.mobile.domain.model.AniListCatalog
import com.kaze.mobile.domain.social.Activity
import com.kaze.mobile.domain.social.Profile
import com.kaze.mobile.domain.sync.ConflictChoice
import com.kaze.mobile.domain.sync.SyncConflict
import com.kaze.mobile.domain.sync.SyncPlan
import com.kaze.mobile.feature.auth.AuthField
import com.kaze.mobile.feature.auth.BackendNotConfiguredCard
import com.kaze.mobile.feature.library.Field
import com.kaze.mobile.feature.settings.ToggleRow
import java.text.DateFormat
import java.util.Date

@Composable
fun Avatar(p: Profile?, size: Int = 44) {
    val c = Kaze.colors
    val theme = p?.profileTheme?.let { KazeThemeId.fromKey(it) }?.let { KazePalettes.of(it) } ?: c
    Box(Modifier.size(size.dp).clip(CircleShape).background(Brush.linearGradient(listOf(theme.primary, theme.accent))), contentAlignment = Alignment.Center) {
        if (p?.avatarUrl != null) AnimeImage(p.avatarUrl, null, Modifier.fillMaxSize())
        else Text((p?.name ?: "?").take(1).uppercase(), style = Kaze.type.title, color = c.onPrimary)
    }
}

@Composable
fun PersonRow(p: Profile, onClick: () -> Unit, trailing: @Composable () -> Unit = {}) {
    Row(Modifier.fillMaxWidth().clickable(role = Role.Button, onClickLabel = "Open ${p.name}'s profile", onClick = onClick).padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Avatar(p)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(p.name, style = Kaze.type.titleSmall, color = Kaze.colors.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text("@${p.username}", style = Kaze.type.bodySmall, color = Kaze.colors.textMuted)
        }
        trailing()
    }
}

fun relativeTime(iso: String?): String {
    val ms = parseIsoMillis(iso)
    if (ms == 0L) return ""
    val diff = (System.currentTimeMillis() - ms) / 1000
    return when {
        diff < 60 -> "just now"
        diff < 3600 -> "${diff / 60}m ago"
        diff < 86_400 -> "${diff / 3600}h ago"
        diff < 7 * 86_400 -> "${diff / 86_400}d ago"
        else -> DateFormat.getDateInstance(DateFormat.MEDIUM).format(Date(ms))
    }
}

fun describeActivity(a: Activity): String = when (a.type) {
    "added" -> "added ${a.animeTitle} to their list"
    "completed" -> "completed ${a.animeTitle}"
    "progress" -> "watched ${a.detail ?: "un episodio"} of ${a.animeTitle}"
    "rated" -> "rated ${a.animeTitle} ${a.detail ?: ""}"
    "review_posted" -> "reviewed ${a.animeTitle}"
    "party_hosted" -> "inició una sala compartida para ${a.animeTitle}"
    "favorited" -> "marcó como favorito ${a.animeTitle}"
    else -> a.animeTitle ?: a.type
}

@Composable
private fun SignedOutNotice(onLogin: () -> Unit, configured: Boolean) {
    Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (!configured) BackendNotConfiguredCard()
        else EmptyState("Sign in to use friends", "Friends, requests and activity are stored in your KAZE account.", icon = Icons.Filled.Group, action = "Sign in", onAction = onLogin)
    }
}

// =========================================================== Friends

@Composable
fun FriendsScreen(onBack: () -> Unit, onOpenUser: (String) -> Unit, onRequests: () -> Unit, onLogin: () -> Unit, signedIn: Boolean, configured: Boolean, vm: FriendsViewModel = hiltViewModel()) {
    val friends by vm.friends.collectAsStateWithLifecycle()
    val incoming by vm.incoming.collectAsStateWithLifecycle()
    val search by vm.search.collectAsStateWithLifecycle()
    var query by rememberSaveable { mutableStateOf("") }
    var confirm by remember { mutableStateOf<Pair<String, Profile>?>(null) }
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(Unit) { vm.messages.collect { snackbar.showSnackbar(it) } }
    LaunchedEffect(query) { kotlinx.coroutines.delay(350); if (signedIn) vm.search(query) }
    val c = Kaze.colors
    Box(Modifier.fillMaxSize()) {
        LazyColumn(contentPadding = PaddingValues(bottom = 120.dp)) {
            item { KazeTopBar("Friends", onBack, actions = { KazeIconButton(Icons.Filled.PersonAdd, "Friend requests (${incoming.data?.size ?: 0})", onRequests) }) }
            if (!signedIn) { item { SignedOutNotice(onLogin, configured) }; return@LazyColumn }
            item {
                Column(Modifier.padding(horizontal = 16.dp)) { AuthField("Find people by username", query, { query = it.take(24) }) }
            }
            if (query.length >= 2) {
                item { SectionHeader("Resultados de búsqueda") }
                if (search.loading) item { Box(Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) { KazeSpinner() } }
                items(search.data.orEmpty(), key = { "s-${it.id}" }) { p ->
                    PersonRow(p, { onOpenUser(p.id) }) { KazeIconButton(Icons.Filled.PersonAdd, "Send friend request to ${p.name}", { vm.send(p) }, tint = c.primary) }
                }
                if (!search.loading && search.data.orEmpty().isEmpty()) item { Text("No users match \"$query\".", style = Kaze.type.bodySmall, color = c.textMuted, modifier = Modifier.padding(horizontal = 20.dp)) }
            }
            (incoming.data?.size ?: 0).takeIf { it > 0 }?.let { n ->
                item { KazeCard(Modifier.fillMaxWidth().padding(16.dp), onClick = onRequests) { Text("$n pending friend request${if (n > 1) "s" else ""} →", style = Kaze.type.title, color = c.primary) } }
            }
            item { SectionHeader("Your friends", subtitle = friends.data?.let { "${it.size} friends" }) }
            when {
                friends.loading && friends.data == null -> item { Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) { KazeSpinner() } }
                friends.error != null -> item { ErrorState(friends.error!!.userMessage, onRetry = { vm.refresh() }, offline = friends.error is KazeError.Offline) }
                friends.data.orEmpty().isEmpty() -> item { EmptyState("No friends yet", "Busca personas arriba y envía una solicitud.", icon = Icons.Filled.Group) }
                else -> items(friends.data.orEmpty(), key = { it.id }) { p ->
                    PersonRow(p, { onOpenUser(p.id) }) {
                        KazeIconButton(Icons.Filled.PersonRemove, "Remove ${p.name}", { confirm = "remove" to p }, tint = c.textMuted)
                        KazeIconButton(Icons.Filled.Block, "Block ${p.name}", { confirm = "block" to p }, tint = c.error)
                    }
                }
            }
        }
        SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter).padding(bottom = 96.dp))
    }
    confirm?.let { (action, p) ->
        AlertDialog(
            onDismissRequest = { confirm = null },
            title = { Text(if (action == "block") "Block ${p.name}?" else "Remove ${p.name}?") },
            text = { Text(if (action == "block") "They won't be able to see your profile, reviews or send you requests. This also removes the friendship." else "You can send a new request later.") },
            confirmButton = { TextButton({ if (action == "block") vm.block(p) else vm.remove(p); confirm = null }) { Text(if (action == "block") "Block" else "Remove", color = c.error) } },
            dismissButton = { TextButton({ confirm = null }) { Text("Cancel") } },
            containerColor = c.surface,
        )
    }
}

@Composable
fun FriendRequestsScreen(onBack: () -> Unit, onOpenUser: (String) -> Unit, vm: FriendsViewModel = hiltViewModel()) {
    val incoming by vm.incoming.collectAsStateWithLifecycle()
    val outgoing by vm.outgoing.collectAsStateWithLifecycle()
    val blocked by vm.blocked.collectAsStateWithLifecycle()
    var tab by rememberSaveable { mutableIntStateOf(0) }
    val c = Kaze.colors
    Column(Modifier.fillMaxSize()) {
        KazeTopBar("Friend requests", onBack)
        Row(Modifier.padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            KazeChip("Received ${incoming.data?.size ?: 0}", selected = tab == 0, onClick = { tab = 0 })
            KazeChip("Sent ${outgoing.data?.size ?: 0}", selected = tab == 1, onClick = { tab = 1 })
            KazeChip("Blocked", selected = tab == 2, onClick = { tab = 2 })
        }
        LazyColumn(contentPadding = PaddingValues(bottom = 120.dp)) {
            when (tab) {
                0 -> {
                    if (incoming.data.orEmpty().isEmpty() && !incoming.loading) item { EmptyState("No requests", "When someone adds you, it shows up here.") }
                    items(incoming.data.orEmpty(), key = { it.id }) { r ->
                        r.sender?.let { p -> PersonRow(p, { onOpenUser(p.id) }) {
                            KazeIconButton(Icons.Filled.Check, "Accept ${p.name}", { vm.accept(r) }, tint = c.success)
                            KazeIconButton(Icons.Filled.Close, "Decline ${p.name}", { vm.reject(r) }, tint = c.error)
                        } }
                    }
                }
                1 -> {
                    if (outgoing.data.orEmpty().isEmpty() && !outgoing.loading) item { EmptyState("Nothing pending", "Requests you send appear here until answered.") }
                    items(outgoing.data.orEmpty(), key = { it.id }) { r ->
                        r.receiver?.let { p -> PersonRow(p, { onOpenUser(p.id) }) { KazeButton("Cancel", { vm.cancel(r) }, kind = KazeButtonKind.Ghost) } }
                    }
                }
                else -> {
                    if (blocked.data.orEmpty().isEmpty() && !blocked.loading) item { EmptyState("No one blocked", "People you block can't see your profile or contact you.") }
                    items(blocked.data.orEmpty(), key = { it.blockedId }) { b ->
                        b.blocked?.let { p -> PersonRow(p, {}) { KazeButton("Unblock", { vm.unblock(p.id) }, kind = KazeButtonKind.Ghost) } }
                    }
                }
            }
        }
    }
}

// =========================================================== Other user's profile

@Composable
fun UserProfileScreen(onBack: () -> Unit, onOpenAnime: (Int) -> Unit, onOpenUser: (String) -> Unit, vm: UserProfileViewModel = hiltViewModel()) {
    val profile by vm.profile.collectAsStateWithLifecycle()
    val rel by vm.relationship.collectAsStateWithLifecycle()
    val mutuals by vm.mutuals.collectAsStateWithLifecycle()
    val activity by vm.activity.collectAsStateWithLifecycle()
    var reporting by remember { mutableStateOf(false) }
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(Unit) { vm.messages.collect { snackbar.showSnackbar(it) } }
    val c = Kaze.colors
    Box(Modifier.fillMaxSize()) {
        LazyColumn(contentPadding = PaddingValues(bottom = 120.dp)) {
            item { KazeTopBar(profile.data?.name ?: "Profile", onBack, actions = { KazeIconButton(Icons.Filled.Flag, "Report profile", { reporting = true }) }) }
            val p = profile.data
            if (p == null) {
                item { if (profile.error != null) ErrorState(profile.error!!.userMessage) else Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) { KazeSpinner() } }
                return@LazyColumn
            }
            item {
                Column(Modifier.fillMaxWidth().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Avatar(p, 96)
                    Text(p.name, style = Kaze.type.headline, color = c.text)
                    Text("@${p.username}", style = Kaze.type.bodySmall, color = c.textMuted)
                    if (p.bio.isNotBlank()) Text(p.bio, style = Kaze.type.body, color = c.text)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) { p.favoriteGenres.take(6).forEach { KazeChip(it) } }
                    val r = rel.data
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        when {
                            r == null -> Unit
                            r.blockedByMe -> KazeButton("Unblock", vm::unblock, kind = KazeButtonKind.Secondary)
                            r.isFriend -> { KazeButton("Friends ✓", {}, kind = KazeButtonKind.Secondary, enabled = false); KazeButton("Remove", vm::removeFriend, kind = KazeButtonKind.Ghost) }
                            r.incoming != null -> KazeButton("Accept request", { vm.accept(r.incoming) })
                            r.outgoing != null -> KazeButton("Cancelar solicitud", { vm.cancel(r.outgoing) }, kind = KazeButtonKind.Secondary)
                            else -> KazeButton("Add friend", vm::addFriend, icon = Icons.Filled.PersonAdd)
                        }
                        if (r != null && !r.blockedByMe) KazeButton("Block", vm::block, icon = Icons.Filled.Block, kind = KazeButtonKind.Ghost)
                    }
                }
            }
            if (mutuals.data.orEmpty().isNotEmpty()) {
                item { SectionHeader("Mutual friends", subtitle = "${mutuals.data!!.size} in common") }
                items(mutuals.data.orEmpty(), key = { "m-${it.id}" }) { m -> PersonRow(m, { onOpenUser(m.id) }) }
            }
            item { SectionHeader("Recent activity") }
            val acts = activity.data.orEmpty()
            if (acts.isEmpty()) item {
                Text(if (p.isPrivate || !p.showActivity) "${p.name} keeps their activity private." else "Nothing to show yet — activity is visible to friends only.", style = Kaze.type.bodySmall, color = c.textMuted, modifier = Modifier.padding(horizontal = 20.dp))
            }
            items(acts, key = { it.id }) { a -> ActivityRow(a, onOpenAnime) }
        }
        SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter).padding(bottom = 96.dp))
    }
    if (reporting) ReportDialog("Report profile", onSend = { vm.report(it); reporting = false }, onDismiss = { reporting = false })
}

@Composable
fun ActivityRow(a: Activity, onOpenAnime: (Int) -> Unit, showUser: Boolean = false) {
    val c = Kaze.colors
    Row(
        Modifier.fillMaxWidth().clickable(enabled = a.animeId != null, role = Role.Button) { a.animeId?.let(onOpenAnime) }.padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (showUser) { Avatar(a.user, 36); Spacer(Modifier.width(10.dp)) }
        Column(Modifier.weight(1f)) {
            Text((if (showUser) (a.user?.name ?: "A friend") + " " else "") + describeActivity(a), style = Kaze.type.body, color = c.text, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(relativeTime(a.createdAt), style = Kaze.type.bodySmall, color = c.textMuted)
        }
        a.animeCover?.let { Box(Modifier.size(40.dp, 56.dp).clip(Kaze.style.posterShape)) { AnimeImage(it, null, Modifier.fillMaxSize()) } }
    }
}

@Composable
fun ReportDialog(title: String, onSend: (String) -> Unit, onDismiss: () -> Unit) {
    var reason by remember { mutableStateOf("") }
    val c = Kaze.colors
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("Spam", "Harassment", "Unmarked spoilers", "Hate speech", "Inappropriate").forEach { r -> KazeChip(r, selected = reason == r, onClick = { reason = r }) }
                }
                Field("Details (optional)", reason, { reason = it.take(500) }, singleLine = false)
            }
        },
        confirmButton = { TextButton({ onSend(reason) }, enabled = reason.length >= 3) { Text("Send report", color = c.error) } },
        dismissButton = { TextButton(onDismiss) { Text("Cancel") } },
        containerColor = c.surface,
    )
}

// =========================================================== Notifications

@Composable
fun NotificationsScreen(onBack: () -> Unit, onOpen: (String) -> Unit, signedIn: Boolean, onLogin: () -> Unit, configured: Boolean, vm: NotificationsViewModel = hiltViewModel()) {
    val items by vm.items.collectAsStateWithLifecycle()
    val c = Kaze.colors
    Column(Modifier.fillMaxSize()) {
        KazeTopBar("Notifications", onBack, actions = { if (signedIn) KazeIconButton(Icons.Filled.DoneAll, "Mark all as read", { vm.markRead(null) }) })
        if (!signedIn) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (!configured) BackendNotConfiguredCard()
                Text("New-episode alerts for anime you're watching work without an account (Settings → Notifications). Social notifications need sign-in.", style = Kaze.type.body, color = c.textMuted)
                if (configured) KazeButton("Sign in", onLogin)
            }
            return@Column
        }
        when {
            items.loading && items.data == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { KazeSpinner() }
            items.error != null -> ErrorState(items.error!!.userMessage, onRetry = { vm.refresh() })
            items.data.orEmpty().isEmpty() -> EmptyState("All caught up", "Friend requests, replies, reactions and party invites appear here — live.", icon = Icons.Filled.Notifications)
            else -> LazyColumn(contentPadding = PaddingValues(bottom = 120.dp)) {
                items(items.data.orEmpty(), key = { it.id }) { n ->
                    Row(
                        Modifier.fillMaxWidth()
                            .background(if (n.readAt == null) c.primary.copy(alpha = 0.08f) else androidx.compose.ui.graphics.Color.Transparent)
                            .clickable(role = Role.Button) {
                                vm.markRead(n)
                                onOpen(when (n.type) { "party_invite" -> "party:${n.entityId}"; "friend_request", "friend_accepted" -> "user:${n.actor?.id ?: ""}"; "reply", "reaction" -> "discussion:${n.entityId}"; else -> "" })
                            }
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Avatar(n.actor, 40)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(n.title, style = Kaze.type.body, color = c.text)
                            if (n.body.isNotBlank()) Text(n.body, style = Kaze.type.bodySmall, color = c.textMuted, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            Text(relativeTime(n.createdAt), style = Kaze.type.overline, color = c.textMuted)
                        }
                        if (n.readAt == null) Box(Modifier.size(10.dp).clip(CircleShape).background(c.accent))
                    }
                }
            }
        }
    }
}

// =========================================================== Edit (remote) profile & privacy

@Composable
fun EditProfileScreen(onBack: () -> Unit, vm: EditProfileViewModel = hiltViewModel()) {
    val profile by vm.profile.collectAsStateWithLifecycle()
    val state by vm.state.collectAsStateWithLifecycle()
    val p = profile.data
    if (state.done) { LaunchedEffect(Unit) { onBack() } }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        KazeTopBar("Edit profile", onBack, subtitle = "Visible to other KAZE users")
        if (p == null) { if (profile.error != null) ErrorState(profile.error!!.userMessage) else Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) { KazeSpinner() }; return@Column }
        var name by rememberSaveable { mutableStateOf(p.displayName) }
        var username by rememberSaveable { mutableStateOf(p.username) }
        var bio by rememberSaveable { mutableStateOf(p.bio) }
        var avatar by rememberSaveable { mutableStateOf(p.avatarUrl.orEmpty()) }
        var banner by rememberSaveable { mutableStateOf(p.bannerUrl.orEmpty()) }
        var theme by rememberSaveable { mutableStateOf(p.profileTheme) }
        var genres by rememberSaveable { mutableStateOf(p.favoriteGenres.toSet()) }
        val c = Kaze.colors
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Field("Display name", name, { name = it.take(40) })
            Field("Username", username, { username = it.take(24) })
            Field("Bio", bio, { bio = it.take(300) }, singleLine = false)
            Field("Avatar image URL (https)", avatar, { avatar = it.take(500) })
            Field("Banner image URL (https)", banner, { banner = it.take(500) })
            Text("Profile theme", style = Kaze.type.title, color = c.text)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                KazeChip("None", selected = theme == null, onClick = { theme = null })
                KazeThemeId.entries.forEach { t -> KazeChip(t.label, selected = theme == t.name, onClick = { theme = t.name }) }
            }
            Text("Favourite genres", style = Kaze.type.title, color = c.text)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                AniListCatalog.genres.forEach { g -> KazeChip(g, selected = g in genres, onClick = { genres = if (g in genres) genres - g else genres + g }) }
            }
            state.error?.let { Text(it, color = c.error, style = Kaze.type.bodySmall) }
            KazeButton("Guardar perfil", { vm.save(name, username, bio, avatar, banner, theme, genres.toList()) }, loading = state.busy, modifier = Modifier.fillMaxWidth())
        }
    }
}

@Composable
fun PrivacyScreen(onBack: () -> Unit, signedIn: Boolean, vm: EditProfileViewModel = hiltViewModel()) {
    val profile by vm.profile.collectAsStateWithLifecycle()
    val state by vm.state.collectAsStateWithLifecycle()
    val c = Kaze.colors
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        KazeTopBar("Privacy", onBack)
        Text(
            "Your on-device library, history and DNA never leave this phone unless you sync them. These settings control what other KAZE users can see; the database enforces them with row-level security.",
            style = Kaze.type.bodySmall, color = c.textMuted, modifier = Modifier.padding(horizontal = 20.dp),
        )
        val p = profile.data
        if (!signedIn) { Text("Sign in to manage profile visibility.", style = Kaze.type.body, color = c.text, modifier = Modifier.padding(20.dp)); return@Column }
        if (p == null) { Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) { KazeSpinner() }; return@Column }
        ToggleRow("Private profile", "Only friends can see your library and collections", p.isPrivate, { vm.savePrivacy(it, p.showActivity, p.showOnline) })
        ToggleRow("Compartir actividad con amigos", "Completions, ratings and reviews in their feed", p.showActivity, { vm.savePrivacy(p.isPrivate, it, p.showOnline) })
        ToggleRow("Show when I'm online", "Tus amigos ven tu presencia en las salas", p.showOnline, { vm.savePrivacy(p.isPrivate, p.showActivity, it) })
        state.info?.let { Text(it, color = c.success, style = Kaze.type.bodySmall, modifier = Modifier.padding(20.dp)) }
        state.error?.let { Text(it, color = c.error, style = Kaze.type.bodySmall, modifier = Modifier.padding(20.dp)) }
    }
}

// =========================================================== Connected accounts & sync

@Composable
fun ConnectedAccountsScreen(onBack: () -> Unit, vm: ConnectedAccountsViewModel = hiltViewModel()) {
    val account by vm.account.collectAsStateWithLifecycle()
    val preview by vm.preview.collectAsStateWithLifecycle()
    val cloud by vm.cloudPreview.collectAsStateWithLifecycle()
    val choices by vm.choices.collectAsStateWithLifecycle()
    val result by vm.result.collectAsStateWithLifecycle()
    val busy by vm.busy.collectAsStateWithLifecycle()
    val auth by vm.authState.collectAsStateWithLifecycle()
    val context: Context = LocalContext.current
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(Unit) { vm.events.collect { snackbar.showSnackbar(it) } }
    val c = Kaze.colors
    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
            KazeTopBar("Connected accounts", onBack)
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                KazeCard(Modifier.fillMaxWidth()) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("AniList", style = Kaze.type.title, color = c.text)
                        when {
                            !vm.anilistConfigured -> Text("Set ANILIST_CLIENT_ID in local.properties and register kaze://anilist-callback as the redirect URL in your AniList developer settings (docs/BACKEND.md).", style = Kaze.type.bodySmall, color = c.textMuted)
                            account == null -> {
                                Text("Import your AniList lists and favourites, and sync progress back. Sign-in happens on anilist.co in your browser; KAZE never sees your password.", style = Kaze.type.bodySmall, color = c.textMuted)
                                KazeButton("Connect AniList", { vm.connect(context) })
                            }
                            else -> {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(Modifier.size(40.dp).clip(CircleShape)) { AnimeImage(account!!.avatar, null, Modifier.fillMaxSize()) }
                                    Spacer(Modifier.width(10.dp))
                                    Text("Connected as ${account!!.name}", style = Kaze.type.body, color = c.text, modifier = Modifier.weight(1f))
                                }
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    KazeButton("Preview sync", vm::loadPreview, loading = preview?.loading == true)
                                    KazeButton("Disconnect", vm::disconnect, kind = KazeButtonKind.Ghost)
                                }
                            }
                        }
                    }
                }
                preview?.let { pv ->
                    pv.error?.let { Text(it.userMessage, color = c.error, style = Kaze.type.bodySmall) }
                    pv.data?.let { data ->
                        SyncPlanCard(data.plan, choices, vm::choose)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            KazeButton("Import only", { vm.apply(push = false) }, kind = KazeButtonKind.Secondary, loading = busy)
                            KazeButton("Import & send changes", { vm.apply(push = true) }, loading = busy, modifier = Modifier.weight(1f))
                        }
                    }
                }
                KazeCard(Modifier.fillMaxWidth()) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("KAZE cloud library", style = Kaze.type.title, color = c.text)
                        if (auth !is com.kaze.mobile.data.backend.AuthState.SignedIn) Text("Inicia sesión para sincronizar tu biblioteca en la nube y compartirla con la versión web.", style = Kaze.type.bodySmall, color = c.textMuted)
                        else {
                            Text("Two-way sync with your account. Conflicting edits are shown to you first.", style = Kaze.type.bodySmall, color = c.textMuted)
                            KazeButton("Preview cloud sync", vm::loadCloudPreview, loading = cloud?.loading == true)
                        }
                    }
                }
                cloud?.let { cp ->
                    cp.error?.let { Text(it.userMessage, color = c.error, style = Kaze.type.bodySmall) }
                    cp.data?.let { plan ->
                        SyncPlanCard(plan, choices, vm::choose)
                        KazeButton("Apply cloud sync", vm::applyCloud, loading = busy, modifier = Modifier.fillMaxWidth())
                    }
                }
                result?.let { Text(it, style = Kaze.type.body, color = c.success) }
            }
        }
        SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter).padding(bottom = 32.dp))
    }
}

@Composable
private fun SyncPlanCard(plan: SyncPlan, choices: Map<Int, ConflictChoice>, onChoose: (Int, ConflictChoice) -> Unit) {
    val c = Kaze.colors
    KazeCard(Modifier.fillMaxWidth()) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Sync preview", style = Kaze.type.title, color = c.text)
            Text("• ${plan.pull.size} to import  • ${plan.push.size} to send  • ${plan.alreadyInSync.size} already match  • ${plan.conflicts.size} conflicts", style = Kaze.type.bodySmall, color = c.text)
            if (plan.conflicts.isNotEmpty()) {
                Text("Both sides changed these. Choose which version to keep — unresolved ones stay untouched.", style = Kaze.type.bodySmall, color = c.warning)
                plan.conflicts.forEach { cf -> ConflictRow(cf, choices[cf.local.animeId], onChoose) }
            }
        }
    }
}

@Composable
private fun ConflictRow(cf: SyncConflict, choice: ConflictChoice?, onChoose: (Int, ConflictChoice) -> Unit) {
    val c = Kaze.colors
    Column(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
        Text(cf.local.title, style = Kaze.type.titleSmall, color = c.text)
        cf.differences.forEach { Text(it, style = Kaze.type.bodySmall, color = c.textMuted) }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            KazeChip("Keep this device", selected = choice == ConflictChoice.KEEP_LOCAL, onClick = { onChoose(cf.local.animeId, ConflictChoice.KEEP_LOCAL) })
            KazeChip("Use remote", selected = choice == ConflictChoice.USE_REMOTE, onClick = { onChoose(cf.local.animeId, ConflictChoice.USE_REMOTE) })
        }
    }
    Spacer(Modifier.height(2.dp))
}

