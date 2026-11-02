package com.kaze.mobile.core.designsystem.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.core.designsystem.theme.LocalReducedMotion
import com.kaze.mobile.core.designsystem.theme.Ornament

// ---------- Section header: every theme announces a section differently ----------

@Composable
fun SectionHeader(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    index: Int? = null,
    onSeeAll: (() -> Unit)? = null,
) {
    val c = Kaze.colors
    val style = Kaze.style
    Row(
        modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        when (style.ornament) {
            Ornament.GLOW -> Box(
                Modifier.width(4.dp).height(22.dp).clip(RoundedCornerShape(2.dp))
                    .background(Brush.verticalGradient(listOf(c.accent, c.primary)))
            )
            Ornament.PETAL -> Text("✿", color = c.primary, style = Kaze.type.title)
            Ornament.CIRCUIT -> Text("//", color = c.accent, style = Kaze.type.label)
            Ornament.EDITORIAL -> if (index != null) Text("%02d".format(index), color = c.primary, style = Kaze.type.overline)
        }
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f).semantics { heading() }) {
            Text(
                if (style.ornament == Ornament.CIRCUIT) title.uppercase() else title,
                style = Kaze.type.title, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
            if (subtitle != null) Text(subtitle, style = Kaze.type.bodySmall, color = c.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        if (onSeeAll != null) {
            Row(
                Modifier.clip(style.chipShape).clickable(role = Role.Button, onClickLabel = "See all $title", onClick = onSeeAll)
                    .defaultMinSize(minHeight = 40.dp).padding(horizontal = 10.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(if (style.uppercaseLabels) "ALL" else "See all", style = Kaze.type.label, color = c.primary)
                Icon(Icons.AutoMirrored.Filled.ArrowForward, null, tint = c.primary, modifier = Modifier.size(16.dp))
            }
        }
    }
}

// ---------- Chips & badges ----------

@Composable
fun KazeChip(
    text: String,
    modifier: Modifier = Modifier,
    selected: Boolean = false,
    icon: ImageVector? = null,
    onClick: (() -> Unit)? = null,
) {
    val c = Kaze.colors
    val shape = Kaze.style.chipShape
    val bg = if (selected) c.primary else c.surfaceHigh.copy(alpha = 0.85f)
    val fg = if (selected) c.onPrimary else c.text
    Row(
        modifier
            .clip(shape)
            .background(bg)
            .border(1.dp, if (selected) Color.Transparent else c.outline, shape)
            .then(if (onClick != null) Modifier.clickable(role = Role.Checkbox, onClick = onClick) else Modifier)
            .semantics { this.selected = selected }
            .defaultMinSize(minHeight = 36.dp)
            .padding(horizontal = 14.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            Icon(icon, null, tint = fg, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(6.dp))
        }
        Text(if (Kaze.style.uppercaseLabels) text.uppercase() else text, style = Kaze.type.label, color = fg, maxLines = 1)
    }
}

@Composable
fun ScoreBadge(score: Int?, modifier: Modifier = Modifier, compact: Boolean = false) {
    if (score == null || score <= 0) return
    val c = Kaze.colors
    val tone = when {
        score >= 80 -> c.success
        score >= 65 -> c.primary
        else -> c.warning
    }
    Row(
        modifier
            .clip(Kaze.style.chipShape)
            .background(c.scrim)
            .padding(horizontal = if (compact) 6.dp else 8.dp, vertical = 3.dp)
            .semantics(mergeDescendants = true) { contentDescription = "Community score $score percent" },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Filled.Star, null, tint = tone, modifier = Modifier.size(if (compact) 12.dp else 14.dp))
        Spacer(Modifier.width(3.dp))
        Text("$score%", style = Kaze.type.label, color = c.text)
    }
}

// ---------- Loading / skeletons ----------

@Composable
fun KazeSpinner(modifier: Modifier = Modifier.size(32.dp), color: Color = Kaze.colors.primary) {
    val reduced = LocalReducedMotion.current
    val t = rememberInfiniteTransition(label = "spin")
    val angle = t.animateFloat(0f, 360f, infiniteRepeatable(tween(900, easing = LinearEasing)), label = "a")
    Canvas(modifier.semantics { contentDescription = "Loading" }) {
        val stroke = size.minDimension / 9f
        drawArc(color.copy(alpha = 0.18f), 0f, 360f, false, style = Stroke(stroke))
        drawArc(color, if (reduced) 0f else angle.value, 100f, false, style = Stroke(stroke, cap = StrokeCap.Round))
    }
}

/** Shimmering placeholder block; the shimmer is a draw-phase animation only. */
@Composable
fun SkeletonBlock(modifier: Modifier = Modifier, shape: androidx.compose.ui.graphics.Shape = Kaze.style.posterShape) {
    val c = Kaze.colors
    val reduced = LocalReducedMotion.current
    val t = rememberInfiniteTransition(label = "shimmer")
    val x = t.animateFloat(-1f, 2f, infiniteRepeatable(tween(1400, easing = LinearEasing), RepeatMode.Restart), label = "x")
    Box(
        modifier
            .clip(shape)
            .drawWithContent {
                val base = c.surfaceHigh
                drawRect(base)
                if (!reduced) {
                    val w = size.width
                    val start = w * x.value
                    drawRect(
                        Brush.linearGradient(
                            listOf(Color.Transparent, c.text.copy(alpha = 0.07f), Color.Transparent),
                            start = Offset(start - w * 0.5f, 0f), end = Offset(start + w * 0.5f, size.height),
                        )
                    )
                }
            }
            .semantics { contentDescription = "Loading" }
    )
}

// ---------- Full states ----------

@Composable
fun ErrorState(
    message: String,
    modifier: Modifier = Modifier,
    title: String = "Something went wrong",
    onRetry: (() -> Unit)? = null,
    offline: Boolean = false,
) {
    val c = Kaze.colors
    Column(
        modifier.fillMaxWidth().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(if (offline) Icons.Filled.CloudOff else Icons.Filled.ErrorOutline, null, tint = c.primary, modifier = Modifier.size(44.dp))
        Text(if (offline) "You're offline" else title, style = Kaze.type.title, color = c.text, textAlign = TextAlign.Center)
        Text(message, style = Kaze.type.body, color = c.textMuted, textAlign = TextAlign.Center)
        if (onRetry != null) KazeButton("Try again", onRetry, kind = KazeButtonKind.Secondary)
    }
}

@Composable
fun EmptyState(
    title: String,
    message: String,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    action: String? = null,
    onAction: (() -> Unit)? = null,
) {
    val c = Kaze.colors
    Column(
        modifier.fillMaxWidth().padding(horizontal = 32.dp, vertical = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (icon != null) {
            Box(
                Modifier.size(72.dp).clip(CircleShape).background(c.primary.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center,
            ) { Icon(icon, null, tint = c.primary, modifier = Modifier.size(34.dp)) }
        }
        Text(title, style = Kaze.type.title, color = c.text, textAlign = TextAlign.Center)
        Text(message, style = Kaze.type.body, color = c.textMuted, textAlign = TextAlign.Center)
        if (action != null && onAction != null) {
            Spacer(Modifier.height(4.dp))
            KazeButton(action, onAction)
        }
    }
}

@Composable
fun OfflineBanner(modifier: Modifier = Modifier) {
    val c = Kaze.colors
    Row(
        modifier.fillMaxWidth().background(c.warning.copy(alpha = 0.18f)).padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Filled.CloudOff, null, tint = c.warning, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(8.dp))
        Text("Offline — showing saved data. We'll refresh when you're back.", style = Kaze.type.bodySmall, color = c.text)
    }
}

@Composable
fun ProgressLine(fraction: Float, modifier: Modifier = Modifier, height: Dp = 3.dp) {
    val c = Kaze.colors
    Box(modifier.fillMaxWidth().height(height).clip(RoundedCornerShape(height)).background(c.text.copy(alpha = 0.15f))) {
        Box(
            Modifier.fillMaxWidth(fraction.coerceIn(0f, 1f)).height(height)
                .background(Brush.horizontalGradient(listOf(c.primary, c.accent)))
        )
    }
}

@Composable
fun Pill(text: String, modifier: Modifier = Modifier, color: Color = Kaze.colors.primary, overImage: Boolean = false) {
    Text(
        if (Kaze.style.uppercaseLabels) text.uppercase() else text,
        style = Kaze.type.overline,
        color = color,
        modifier = modifier
            .clip(Kaze.style.chipShape)
            // Over artwork a faint tint is unreadable, so lay a dark backing under it first.
            .then(if (overImage) Modifier.background(Color.Black.copy(alpha = 0.66f)) else Modifier)
            .background(color.copy(alpha = 0.14f))
            .padding(horizontal = 8.dp, vertical = 3.dp),
    )
}
