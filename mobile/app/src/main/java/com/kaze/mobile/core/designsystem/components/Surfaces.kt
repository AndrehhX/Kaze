package com.kaze.mobile.core.designsystem.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.kaze.mobile.core.designsystem.motion.pressScale
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.core.designsystem.theme.Ornament

/**
 * Theme-aware container. Neon glows, Sakura floats on a soft shadow, Cyber gets a
 * cut-corner HUD frame with corner ticks, Zen is flat paper with a hairline rule.
 */
@Composable
fun KazeCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    onClickLabel: String? = null,
    shape: Shape = Kaze.style.cardShape,
    padding: PaddingValues = PaddingValues(16.dp),
    highlighted: Boolean = false,
    content: @Composable BoxScope.() -> Unit,
) {
    val c = Kaze.colors
    val style = Kaze.style
    val interaction = remember { MutableInteractionSource() }
    val base = when (style.ornament) {
        Ornament.GLOW -> modifier
            .shadow(if (highlighted) 18.dp else 8.dp, shape, ambientColor = c.primary, spotColor = c.primary)
            .clip(shape)
            .background(Brush.linearGradient(listOf(c.surfaceHigh, c.surface)))
            .border(BorderStroke(1.dp, Brush.linearGradient(listOf(c.primary.copy(alpha = if (highlighted) 0.8f else 0.35f), c.accent.copy(alpha = 0.12f)))), shape)
        Ornament.PETAL -> modifier
            .shadow(if (highlighted) 14.dp else 6.dp, shape, ambientColor = c.primary.copy(alpha = 0.4f), spotColor = c.primary.copy(alpha = 0.35f))
            .clip(shape)
            .background(c.surface)
        Ornament.CIRCUIT -> modifier
            .clip(shape)
            .background(c.surface.copy(alpha = 0.92f))
            .border(1.dp, c.primary.copy(alpha = if (highlighted) 0.9f else 0.35f), shape)
            .drawBehind { cornerTicks(c.accent) }
        Ornament.EDITORIAL -> modifier
            .clip(shape)
            .background(c.surface)
            .border(1.dp, c.outline, shape)
    }
    val clickable = if (onClick != null) {
        Modifier
            .pressScale(interaction, 0.98f)
            .clickable(interaction, indication = androidx.compose.material3.ripple(color = c.primary), onClickLabel = onClickLabel, role = Role.Button, onClick = onClick)
    } else Modifier
    Box(base.then(clickable).padding(padding)) {
        CompositionLocalProvider(LocalContentColor provides c.text) { content() }
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.cornerTicks(color: Color) {
    val l = 10.dp.toPx()
    val w = 2.dp.toPx()
    drawLine(color, Offset(0f, 0f), Offset(l, 0f), w)
    drawLine(color, Offset(0f, 0f), Offset(0f, l), w)
    drawLine(color, Offset(size.width, size.height), Offset(size.width - l, size.height), w)
    drawLine(color, Offset(size.width, size.height), Offset(size.width, size.height - l), w)
}

enum class KazeButtonKind { Primary, Secondary, Ghost }

@Composable
fun KazeButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    kind: KazeButtonKind = KazeButtonKind.Primary,
    enabled: Boolean = true,
    loading: Boolean = false,
    minHeight: Dp = 48.dp,
) {
    val c = Kaze.colors
    val style = Kaze.style
    val shape = style.buttonShape
    val interaction = remember { MutableInteractionSource() }
    val alpha = if (enabled) 1f else 0.45f
    val bg: Modifier = when (kind) {
        KazeButtonKind.Primary -> when (style.ornament) {
            Ornament.GLOW -> Modifier
                .shadow(14.dp, shape, ambientColor = c.primary, spotColor = c.accent)
                .background(Brush.horizontalGradient(listOf(c.primary.copy(alpha = alpha), c.accent.copy(alpha = alpha))), shape)
            Ornament.CIRCUIT -> Modifier.background(c.primary.copy(alpha = alpha), shape)
            else -> Modifier.background(c.primary.copy(alpha = alpha), shape)
        }
        KazeButtonKind.Secondary -> Modifier
            .background(c.surfaceHigh.copy(alpha = 0.9f * alpha), shape)
            .border(1.dp, c.primary.copy(alpha = 0.4f * alpha), shape)
        KazeButtonKind.Ghost -> Modifier
    }
    val content = when (kind) {
        KazeButtonKind.Primary -> c.onPrimary
        else -> c.text.copy(alpha = alpha)
    }
    Row(
        modifier = modifier
            .pressScale(interaction)
            .defaultMinSize(minHeight = minHeight, minWidth = 48.dp)
            .clip(shape)
            .then(bg)
            .clickable(interaction, androidx.compose.material3.ripple(), enabled = enabled && !loading, role = Role.Button, onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        if (loading) {
            KazeSpinner(Modifier.size(18.dp), color = content)
            androidx.compose.foundation.layout.Spacer(Modifier.size(8.dp))
        } else if (icon != null) {
            Icon(icon, contentDescription = null, tint = content, modifier = Modifier.size(20.dp))
            androidx.compose.foundation.layout.Spacer(Modifier.size(8.dp))
        }
        Text(
            if (style.uppercaseLabels) text.uppercase() else text,
            style = Kaze.type.label,
            color = content,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
fun KazeIconButton(
    icon: ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    tint: Color = Kaze.colors.text,
    background: Color = Color.Transparent,
    enabled: Boolean = true,
) {
    val interaction = remember { MutableInteractionSource() }
    Box(
        modifier
            .pressScale(interaction, 0.88f)
            .size(48.dp)
            .clip(androidx.compose.foundation.shape.CircleShape)
            .background(background)
            .clickable(interaction, androidx.compose.material3.ripple(bounded = false, radius = 24.dp), enabled = enabled, role = Role.Button, onClickLabel = contentDescription, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = contentDescription, tint = tint.copy(alpha = if (enabled) 1f else 0.4f))
    }
}

@Composable
fun KazeRowItem(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    content: @Composable RowScope.() -> Unit,
) {
    Row(
        modifier
            .then(if (onClick != null) Modifier.clickable(role = Role.Button, onClick = onClick) else Modifier)
            .defaultMinSize(minHeight = 56.dp)
            .padding(horizontal = 20.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        content = content,
    )
}
