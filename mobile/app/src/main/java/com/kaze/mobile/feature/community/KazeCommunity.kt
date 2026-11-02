package com.kaze.mobile.feature.community

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Reply
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ChatBubbleOutline
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Forum
import androidx.compose.material.icons.filled.RateReview
import androidx.compose.material.icons.filled.Group
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.kaze.mobile.core.designsystem.components.AnimeImage
import com.kaze.mobile.core.designsystem.components.EmptyState
import com.kaze.mobile.core.designsystem.components.ErrorState
import com.kaze.mobile.core.designsystem.components.KazeButton
import com.kaze.mobile.core.designsystem.components.KazeButtonKind
import com.kaze.mobile.core.designsystem.components.KazeCard
import com.kaze.mobile.core.designsystem.components.KazeIconButton
import com.kaze.mobile.core.designsystem.components.KazeSpinner
import com.kaze.mobile.core.designsystem.components.KazeTopBar
import com.kaze.mobile.core.designsystem.components.Pill
import com.kaze.mobile.core.designsystem.components.SpoilerShield
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.core.text.SafeRichText
import com.kaze.mobile.domain.social.Comment
import com.kaze.mobile.domain.social.Review
import com.kaze.mobile.feature.library.Field
import com.kaze.mobile.feature.social.ActivityRow
import com.kaze.mobile.feature.social.Avatar
import com.kaze.mobile.feature.social.DiscussionViewModel
import com.kaze.mobile.feature.social.DiscussionsViewModel
import com.kaze.mobile.feature.social.FeedViewModel
import com.kaze.mobile.feature.social.KazeReviewsViewModel
import com.kaze.mobile.feature.social.ReportDialog
import com.kaze.mobile.feature.social.WriteReviewViewModel
import com.kaze.mobile.feature.social.relativeTime
import kotlin.math.roundToInt

/** Renders user text safely (markdown-lite, inline ||spoilers|| blocked out until revealed). */
@Composable
fun UserText(text: String, maxLines: Int = Int.MAX_VALUE) {
    val c = Kaze.colors
    var reveal by remember { mutableStateOf(false) }
    val annotated = remember(text, reveal, c.text) { SafeRichText.markdownLite(text, reveal, c.text, c.surfaceHigh) }
    Text(annotated, style = Kaze.type.body, color = c.text, maxLines = maxLines, overflow = TextOverflow.Ellipsis)
    if (!reveal && SafeRichText.containsInlineSpoiler(text)) KazeButton("Reveal inline spoilers", { reveal = true }, kind = KazeButtonKind.Ghost)
}

@Composable
private fun NeedsAccount(signedIn: Boolean, onLogin: () -> Unit, what: String): Boolean {
    if (signedIn) return false
    EmptyState("Sign in to see $what", "Community posts live in the KAZE backend and require an account.", action = "Sign in", onAction = onLogin)
    return true
}

@Composable
fun FriendsFeedTab(signedIn: Boolean, onLogin: () -> Unit, onOpenAnime: (Int) -> Unit, onFriends: () -> Unit, vm: FeedViewModel = hiltViewModel()) {
    if (NeedsAccount(signedIn, onLogin, "your friends' activity")) return
    val feed by vm.feed.collectAsStateWithLifecycle()
    when {
        feed.loading && feed.data == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { KazeSpinner() }
        feed.error != null -> ErrorState(feed.error!!.userMessage, onRetry = { vm.refresh() })
        feed.data.orEmpty().isEmpty() -> EmptyState("Quiet in here", "Cuando tus amigos completen, califiquen o reseñen anime, aparecerá aquí. Solo se muestra la actividad compartida.", icon = Icons.Filled.Group, action = "Find friends", onAction = onFriends)
        else -> LazyColumn(contentPadding = PaddingValues(bottom = 120.dp)) { items(feed.data.orEmpty(), key = { it.id }) { ActivityRow(it, onOpenAnime, showUser = true) } }
    }
}

@Composable
fun KazeReviewsTab(signedIn: Boolean, onLogin: () -> Unit, onOpenAnime: (Int) -> Unit, onOpenUser: (String) -> Unit, vm: KazeReviewsViewModel = hiltViewModel()) {
    if (NeedsAccount(signedIn, onLogin, "KAZE reviews")) return
    val reviews by vm.reviews.collectAsStateWithLifecycle()
    val liked by vm.liked.collectAsStateWithLifecycle()
    var reporting by remember { mutableStateOf<Review?>(null) }
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(Unit) { vm.messages.collect { snackbar.showSnackbar(it) } }
    Box(Modifier.fillMaxSize()) {
        when {
            reviews.loading && reviews.data == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { KazeSpinner() }
            reviews.error != null -> ErrorState(reviews.error!!.userMessage, onRetry = { vm.refresh() })
            reviews.data.orEmpty().isEmpty() -> EmptyState("No KAZE reviews yet", "Abre cualquier anime y toca «Escribir una reseña».", icon = Icons.Filled.RateReview)
            else -> LazyColumn(contentPadding = PaddingValues(bottom = 120.dp)) {
                items(reviews.data.orEmpty(), key = { it.id }) { r ->
                    KazeCard(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                r.animeCover?.let { Box(Modifier.size(40.dp, 56.dp).clip(Kaze.style.posterShape)) { AnimeImage(it, null, Modifier.fillMaxSize()) }; Spacer(Modifier.width(10.dp)) }
                                Column(Modifier.weight(1f)) {
                                    Text(r.animeTitle, style = Kaze.type.titleSmall, color = Kaze.colors.text, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(bottom = 2.dp))
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Avatar(r.author, 20); Spacer(Modifier.width(6.dp))
                                        Text("${r.author?.name ?: "KAZE user"} · ${relativeTime(r.createdAt)}", style = Kaze.type.bodySmall, color = Kaze.colors.textMuted,
                                            modifier = Modifier.padding(end = 4.dp))
                                    }
                                }
                                Pill("${r.score}/100")
                            }
                            SpoilerShield(r.hasSpoilers, label = "Reseña con spoilers") { UserText(r.body, maxLines = 8) }
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                val isLiked = "review:${r.id}" in liked
                                KazeIconButton(if (isLiked) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder, if (isLiked) "Ya no me gusta" else "Me gusta", { vm.like(r) }, tint = if (isLiked) Kaze.colors.accent else Kaze.colors.textMuted)
                                Text("${r.likeCount}", style = Kaze.type.label, color = Kaze.colors.textMuted)
                                Spacer(Modifier.weight(1f))
                                KazeButton("Open anime", { onOpenAnime(r.animeId) }, kind = KazeButtonKind.Ghost)
                                r.author?.let { a -> KazeButton("Profile", { onOpenUser(a.id) }, kind = KazeButtonKind.Ghost) }
                                KazeIconButton(Icons.Filled.Flag, "Reportar reseña", { reporting = r }, tint = Kaze.colors.textMuted)
                            }
                        }
                    }
                }
            }
        }
        SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter).padding(bottom = 96.dp))
    }
    reporting?.let { r -> ReportDialog("Reportar reseña", onSend = { vm.report(r, it); reporting = null }, onDismiss = { reporting = null }) }
}

@Composable
fun DiscussionsTab(signedIn: Boolean, onLogin: () -> Unit, onOpen: (String) -> Unit, vm: DiscussionsViewModel = hiltViewModel()) {
    if (NeedsAccount(signedIn, onLogin, "discussions")) return
    val list by vm.discussions.collectAsStateWithLifecycle()
    val error by vm.error.collectAsStateWithLifecycle()
    var composing by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(Unit) { vm.created.collect { composing = false; onOpen(it) } }
    val c = Kaze.colors
    Box(Modifier.fillMaxSize()) {
        when {
            list.loading && list.data == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { KazeSpinner() }
            list.error != null -> ErrorState(list.error!!.userMessage, onRetry = { vm.refresh() })
            list.data.orEmpty().isEmpty() -> EmptyState("Start the first discussion", "Theories, favourite scenes, seasonal hype — mark spoilers and they stay hidden.", icon = Icons.Filled.Forum, action = "New discussion", onAction = { composing = true })
            else -> LazyColumn(contentPadding = PaddingValues(bottom = 160.dp)) {
                items(list.data.orEmpty(), key = { it.id }) { d ->
                    KazeCard(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp), onClick = { onOpen(d.id) }, onClickLabel = "Open discussion ${d.title}") {
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Avatar(d.author, 24); Spacer(Modifier.width(8.dp))
                                Text("${d.author?.name ?: "KAZE user"} · ${relativeTime(d.lastActivityAt ?: d.createdAt)}", style = Kaze.type.bodySmall, color = c.textMuted, modifier = Modifier.weight(1f))
                                if (d.hasSpoilers) Pill("Spoilers", color = c.warning)
                            }
                            Text(d.title, style = Kaze.type.title, color = c.text)
                            if (!d.hasSpoilers) Text(d.body, style = Kaze.type.bodySmall, color = c.textMuted, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                androidx.compose.material3.Icon(Icons.Filled.ChatBubbleOutline, null, tint = c.textMuted, modifier = Modifier.size(16.dp))
                                Text(" ${d.commentCount}   ♥ ${d.likeCount}", style = Kaze.type.label, color = c.textMuted)
                            }
                        }
                    }
                }
            }
        }
        KazeButton("New discussion", { composing = true }, icon = Icons.Filled.Add, modifier = Modifier.align(Alignment.BottomEnd).padding(end = 20.dp, bottom = 100.dp))
    }
    if (composing) {
        var title by rememberSaveable { mutableStateOf("") }
        var body by rememberSaveable { mutableStateOf("") }
        var spoilers by rememberSaveable { mutableStateOf(false) }
        ModalBottomSheet({ composing = false }, containerColor = c.surface, shape = Kaze.style.sheetShape) {
            Column(Modifier.padding(20.dp).padding(bottom = 24.dp).imePadding(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("New discussion", style = Kaze.type.headline, color = c.text)
                Field("Title", title, { title = it.take(140) })
                Field("What's on your mind? **bold**, *italic*, ||spoiler||", body, { body = it.take(8000) }, singleLine = false)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Contains spoilers", style = Kaze.type.body, color = c.text, modifier = Modifier.weight(1f))
                    Switch(spoilers, { spoilers = it }, colors = SwitchDefaults.colors(checkedTrackColor = c.primary))
                }
                error?.let { Text(it, color = c.error, style = Kaze.type.bodySmall) }
                KazeButton("Post", { vm.create(title, body, spoilers) }, modifier = Modifier.fillMaxWidth())
            }
        }
    }
}

@Composable
fun DiscussionDetailScreen(onBack: () -> Unit, onOpenUser: (String) -> Unit, vm: DiscussionViewModel = hiltViewModel()) {
    val d by vm.discussion.collectAsStateWithLifecycle()
    val comments by vm.comments.collectAsStateWithLifecycle()
    val liked by vm.liked.collectAsStateWithLifecycle()
    val error by vm.error.collectAsStateWithLifecycle()
    var replyTo by remember { mutableStateOf<Comment?>(null) }
    var draft by rememberSaveable { mutableStateOf("") }
    var spoiler by rememberSaveable { mutableStateOf(false) }
    var reporting by remember { mutableStateOf<Pair<String, String>?>(null) }
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(Unit) { vm.messages.collect { snackbar.showSnackbar(it) } }
    val c = Kaze.colors
    Box(Modifier.fillMaxSize().imePadding()) {
        Column(Modifier.fillMaxSize()) {
            KazeTopBar("Discussion", onBack)
            LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(bottom = 24.dp)) {
                val disc = d.data
                if (disc == null) { item { if (d.error != null) ErrorState(d.error!!.userMessage) else Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) { KazeSpinner() } }; return@LazyColumn }
                item {
                    Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(disc.title, style = Kaze.type.headline, color = c.text)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Avatar(disc.author, 28); Spacer(Modifier.width(8.dp))
                            Text("${disc.author?.name ?: "KAZE user"} · ${relativeTime(disc.createdAt)}", style = Kaze.type.bodySmall, color = c.textMuted, modifier = Modifier.weight(1f))
                            KazeIconButton(Icons.Filled.Flag, "Report discussion", { reporting = "discussion" to disc.id }, tint = c.textMuted)
                        }
                        SpoilerShield(disc.hasSpoilers, label = "Spoiler discussion") { Column { UserText(disc.body) } }
                        val isLiked = "discussion:${disc.id}" in liked
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            KazeIconButton(if (isLiked) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder, if (isLiked) "Unlike" else "Like", { vm.like("discussion", disc.id) }, tint = if (isLiked) c.accent else c.textMuted)
                            Text("${disc.likeCount} · ${disc.commentCount} comments", style = Kaze.type.label, color = c.textMuted)
                        }
                    }
                }
                items(comments.data.orEmpty(), key = { it.comment.id }) { t ->
                    val cm = t.comment
                    Column(Modifier.fillMaxWidth().padding(start = (16 + t.depth * 18).dp, end = 16.dp, top = 6.dp, bottom = 6.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Avatar(cm.author, 24); Spacer(Modifier.width(8.dp))
                            Text(cm.author?.name ?: "KAZE user", style = Kaze.type.label, color = c.text, modifier = Modifier.weight(1f))
                            Text(relativeTime(cm.createdAt), style = Kaze.type.overline, color = c.textMuted)
                        }
                        if (cm.isDeleted) Text("[deleted]", style = Kaze.type.bodySmall, color = c.textMuted)
                        else SpoilerShield(cm.hasSpoilers, label = "Comentario con spoilers") { Column { UserText(cm.body) } }
                        if (!cm.isDeleted) Row(verticalAlignment = Alignment.CenterVertically) {
                            val isLiked = "comment:${cm.id}" in liked
                            KazeIconButton(if (isLiked) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder, "Me gusta", { vm.like("comment", cm.id) }, tint = if (isLiked) c.accent else c.textMuted)
                            Text("${cm.likeCount}", style = Kaze.type.overline, color = c.textMuted)
                            KazeIconButton(Icons.AutoMirrored.Filled.Reply, "Reply to ${cm.author?.name ?: "comment"}", { replyTo = cm }, tint = c.textMuted)
                            if (cm.userId == vm.myId) KazeIconButton(Icons.Filled.Delete, "Eliminar mi comentario", { vm.delete(cm) }, tint = c.textMuted)
                            else KazeIconButton(Icons.Filled.Flag, "Reportar comentario", { reporting = "comment" to cm.id }, tint = c.textMuted)
                            cm.author?.let { a -> KazeButton("Profile", { onOpenUser(a.id) }, kind = KazeButtonKind.Ghost) }
                        }
                    }
                }
            }
            Column(Modifier.fillMaxWidth().padding(12.dp)) {
                replyTo?.let { r -> Row(verticalAlignment = Alignment.CenterVertically) { Text("Replying to ${r.author?.name ?: "comment"}", style = Kaze.type.bodySmall, color = c.primary, modifier = Modifier.weight(1f)); KazeButton("Cancel", { replyTo = null }, kind = KazeButtonKind.Ghost) } }
                error?.let { Text(it, color = c.error, style = Kaze.type.bodySmall) }
                Field("Añadir un comentario", draft, { draft = it.take(4000) }, singleLine = false)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Spoiler", style = Kaze.type.bodySmall, color = c.text)
                    Switch(spoiler, { spoiler = it }, colors = SwitchDefaults.colors(checkedTrackColor = c.primary))
                    Spacer(Modifier.weight(1f))
                    KazeButton("Send", { vm.post(draft, replyTo, spoiler) { draft = ""; replyTo = null; spoiler = false } }, enabled = draft.isNotBlank())
                }
            }
        }
        SnackbarHost(snackbar, Modifier.align(Alignment.TopCenter).padding(top = 80.dp))
    }
    reporting?.let { (type, id) -> ReportDialog("Report $type", onSend = { vm.report(type, id, it); reporting = null }, onDismiss = { reporting = null }) }
}

@Composable
fun WriteReviewScreen(onBack: () -> Unit, signedIn: Boolean, onLogin: () -> Unit, vm: WriteReviewViewModel = hiltViewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    var score by rememberSaveable { mutableFloatStateOf(75f) }
    var body by rememberSaveable { mutableStateOf("") }
    var spoilers by rememberSaveable { mutableStateOf(false) }
    if (state.done) LaunchedEffect(Unit) { onBack() }
    val c = Kaze.colors
    Column(Modifier.fillMaxSize().imePadding().verticalScroll(rememberScrollState())) {
        KazeTopBar("Review", onBack, subtitle = vm.route.title)
        if (!signedIn) { EmptyState("Inicia sesión para reseñar", "Reviews are posted to the KAZE community under your profile.", action = "Sign in", onAction = onLogin); return@Column }
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Calificación: ${score.roundToInt()}/100", style = Kaze.type.title, color = c.text)
            Slider(score, { score = (it / 5).roundToInt() * 5f }, valueRange = 5f..100f, steps = 18, colors = SliderDefaults.colors(thumbColor = c.primary, activeTrackColor = c.primary))
            Field("Tu reseña (mínimo 20 caracteres). **negrita**, *cursiva*, ||spoiler||", body, { body = it.take(8000) }, singleLine = false)
            Text("${body.length}/8000", style = Kaze.type.overline, color = c.textMuted)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Contains spoilers", style = Kaze.type.body, color = c.text)
                    Text("La reseña se ocultará tras un aviso hasta que el usuario decida leerla.", style = Kaze.type.bodySmall, color = c.textMuted)
                }
                Switch(spoilers, { spoilers = it }, colors = SwitchDefaults.colors(checkedTrackColor = c.primary))
            }
            state.error?.let { Text(it, color = c.error, style = Kaze.type.bodySmall) }
            KazeButton("Publicar reseña", { vm.submit(score.roundToInt(), body, spoilers, null) }, loading = state.busy, enabled = body.trim().length >= 20, modifier = Modifier.fillMaxWidth())
        }
    }
}
