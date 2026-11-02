package com.kaze.mobile.core.designsystem.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.SubcomposeAsyncImage
import coil3.request.ImageRequest
import coil3.request.crossfade
import com.kaze.mobile.core.designsystem.theme.Kaze

/** Parses AniList's "#rrggbb" cover colour, used as a tasteful placeholder while art loads. */
fun parseHexColor(hex: String?): Color? = runCatching {
    if (hex.isNullOrBlank()) null else Color(android.graphics.Color.parseColor(hex))
}.getOrNull()

@Composable
fun AnimeImage(
    url: String?,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    placeholderColor: Color? = null,
    contentScale: ContentScale = ContentScale.Crop,
) {
    val c = Kaze.colors
    val fallback = placeholderColor ?: c.surfaceHigh
    if (url.isNullOrBlank()) {
        ImageFallback(modifier, fallback, contentDescription)
        return
    }
    SubcomposeAsyncImage(
        model = ImageRequest.Builder(LocalContext.current).data(url).crossfade(!Kaze.reducedMotion).build(),
        contentDescription = contentDescription,
        contentScale = contentScale,
        modifier = modifier,
        loading = { Box(Modifier.fillMaxSize().background(fallback.copy(alpha = 0.55f))) },
        error = { ImageFallback(Modifier.fillMaxSize(), fallback, contentDescription) },
    )
}

@Composable
private fun ImageFallback(modifier: Modifier, color: Color, description: String?) {
    val c = Kaze.colors
    Box(
        modifier.background(Brush.linearGradient(listOf(color.copy(alpha = 0.7f), c.surface))),
        contentAlignment = Alignment.Center,
    ) {
        Text("風", style = Kaze.type.headline, color = c.text.copy(alpha = 0.25f)) // 風
        if (description != null) Box(Modifier.semantics { contentDescription = description })
    }
}

@Composable
fun KazeTopBar(
    title: String,
    onBack: (() -> Unit)?,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    actions: @Composable () -> Unit = {},
) {
    val c = Kaze.colors
    Row(
        modifier.fillMaxWidth().windowInsetsPadding(WindowInsets.statusBars).padding(horizontal = 4.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (onBack != null) KazeIconButton(Icons.AutoMirrored.Filled.ArrowBack, "Back", onBack)
        else Spacer(Modifier.size(16.dp))
        Column(Modifier.weight(1f).padding(horizontal = 4.dp)) {
            Text(title, style = Kaze.type.title, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (subtitle != null) Text(subtitle, style = Kaze.type.bodySmall, color = c.textMuted, maxLines = 1)
        }
        actions()
    }
}

/**
 * Animated spoiler shield. Content is blurred (API 31+) *and* covered, so it is never
 * readable until the user explicitly taps reveal; TalkBack only hears the warning.
 */
@Composable
fun SpoilerShield(
    isSpoiler: Boolean,
    modifier: Modifier = Modifier,
    label: String = "Spoiler",
    content: @Composable () -> Unit,
) {
    if (!isSpoiler) { Box(modifier) { content() }; return }
    var revealed by rememberSaveable { mutableStateOf(false) }
    val c = Kaze.colors
    val reduced = Kaze.reducedMotion
    val blur by animateFloatAsState(if (revealed) 0f else 1f, if (reduced) tween(0) else spring(0.85f, Spring.StiffnessLow), label = "blur")
    Box(modifier.clip(Kaze.style.cardShape)) {
        Box(
            Modifier
                .graphicsLayer { alpha = 1f - blur * 0.85f }
                .blur((18 * blur).dp)
                .semantics { if (!revealed) contentDescription = "Hidden spoiler content" }
        ) { if (revealed || blur < 1f) content() else Box(Modifier.fillMaxWidth().height(64.dp)) }
        AnimatedContent(
            targetState = revealed,
            transitionSpec = { fadeIn(tween(if (reduced) 0 else 220)) togetherWith fadeOut(tween(if (reduced) 0 else 320)) },
            label = "spoiler",
            modifier = Modifier.matchParentSize(),
        ) { isRevealed ->
            if (!isRevealed) {
                Row(
                    Modifier
                        .fillMaxSize()
                        .background(Brush.linearGradient(listOf(c.surfaceHigh.copy(alpha = 0.97f), c.primary.copy(alpha = 0.35f))))
                        .clickable(role = Role.Button, onClickLabel = "Reveal spoiler") { revealed = true }
                        .semantics { stateDescription = "Hidden" }
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center,
                ) {
                    Icon(Icons.Filled.VisibilityOff, null, tint = c.primary)
                    Spacer(Modifier.size(10.dp))
                    Column {
                        Text("$label — tap to reveal", style = Kaze.type.titleSmall, color = c.text)
                        Text("Contains plot details", style = Kaze.type.bodySmall, color = c.textMuted)
                    }
                }
            } else {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopEnd) {
                    KazeIconButton(Icons.Filled.Visibility, "Hide spoiler again", { revealed = false }, tint = c.textMuted)
                }
            }
        }
    }
}
