package com.kaze.mobile.navigation

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.core.designsystem.theme.MotionPersonality
import com.kaze.mobile.core.designsystem.theme.Ornament

/**
 * Signature interaction #8 — the navigation indicator. Neon: a glowing pill that springs;
 * Sakura: a soft blob with a bouncy settle; Cyber: a scanline that snaps directionally;
 * Zen: a hairline underline with a restrained glide.
 */
@Composable
fun KazeBottomBar(selected: Int, onSelect: (TopLevel) -> Unit, modifier: Modifier = Modifier) {
    val c = Kaze.colors
    val style = Kaze.style
    val reduced = Kaze.reducedMotion
    val floating = style.ornament == Ornament.GLOW || style.ornament == Ornament.PETAL
    val shape = if (floating) RoundedCornerShape(if (style.ornament == Ornament.PETAL) 32.dp else 26.dp) else RoundedCornerShape(0.dp)
    Box(
        modifier
            .fillMaxWidth()
            .windowInsetsPadding(WindowInsets.navigationBars)
            .padding(horizontal = if (floating) 16.dp else 0.dp, vertical = if (floating) 10.dp else 0.dp)
    ) {
        BoxWithConstraints(
            Modifier
                .fillMaxWidth()
                .height(68.dp)
                .then(if (floating) Modifier.shadow(18.dp, shape, ambientColor = c.primary, spotColor = c.primary) else Modifier)
                .clip(shape)
                .background(c.surface)
                .then(if (style.ornament == Ornament.CIRCUIT) Modifier.border(1.dp, c.primary.copy(alpha = 0.3f)) else Modifier)
                .then(if (style.ornament == Ornament.EDITORIAL) Modifier.border(1.dp, c.outline) else Modifier)
        ) {
            val itemWidth = maxWidth / TopLevel.entries.size
            val spec = when {
                reduced -> tween<Dp>(0)
                style.motion == MotionPersonality.SPRING -> spring(0.62f, Spring.StiffnessMediumLow)
                style.motion == MotionPersonality.SOFT -> spring(0.5f, Spring.StiffnessLow)
                style.motion == MotionPersonality.DIRECTIONAL -> tween(160)
                else -> tween(300)
            }
            val x by animateDpAsState(itemWidth * selected, spec, label = "nav-indicator")
            when (style.ornament) {
                Ornament.GLOW -> Box(
                    Modifier.offset(x = x + itemWidth / 2 - 30.dp, y = 10.dp).size(60.dp, 34.dp)
                        .shadow(12.dp, CircleShape, ambientColor = c.accent, spotColor = c.primary)
                        .clip(CircleShape)
                        .background(Brush.horizontalGradient(listOf(c.primary.copy(alpha = 0.55f), c.accent.copy(alpha = 0.45f))))
                )
                Ornament.PETAL -> Box(
                    Modifier.offset(x = x + itemWidth / 2 - 32.dp, y = 8.dp).size(64.dp, 38.dp)
                        .clip(RoundedCornerShape(50)).background(c.primary.copy(alpha = 0.22f))
                )
                Ornament.CIRCUIT -> Box(
                    Modifier.offset(x = x + 12.dp).width(itemWidth - 24.dp).height(3.dp).background(c.primary)
                )
                Ornament.EDITORIAL -> Box(
                    Modifier.offset(x = x + itemWidth / 2 - 12.dp, y = 60.dp).width(24.dp).height(2.dp).background(c.primary)
                )
            }
            Row(Modifier.fillMaxSize().selectableGroup()) {
                TopLevel.entries.forEachIndexed { i, dest ->
                    val isSel = i == selected
                    Column(
                        Modifier.weight(1f).fillMaxHeight()
                            .selectable(isSel, role = Role.Tab, onClick = { onSelect(dest) }),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        Icon(if (isSel) dest.selectedIcon else dest.icon, contentDescription = null, tint = if (isSel) (if (style.ornament == Ornament.GLOW) c.text else c.primary) else c.textMuted)
                        Text(
                            if (style.uppercaseLabels) dest.label.uppercase() else dest.label,
                            style = Kaze.type.overline.copy(letterSpacing = 0.04.em),
                            color = if (isSel) c.text else c.textMuted,
                            maxLines = 1,
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun KazeNavRail(selected: Int, onSelect: (TopLevel) -> Unit, modifier: Modifier = Modifier) {
    val c = Kaze.colors
    val reduced = Kaze.reducedMotion
    Column(
        modifier.fillMaxHeight().width(88.dp).background(c.surface.copy(alpha = 0.92f)).windowInsetsPadding(WindowInsets.systemBars).selectableGroup(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("風", style = Kaze.type.headline, color = c.primary, modifier = Modifier.padding(vertical = 20.dp))
        Box {
            val itemH = 76.dp
            val y by animateDpAsState(itemH * selected, if (reduced) tween(0) else spring(0.7f, Spring.StiffnessMediumLow), label = "rail")
            Box(Modifier.offset(y = y + 14.dp, x = 12.dp).size(64.dp, 48.dp).clip(Kaze.style.chipShape).background(c.primary.copy(alpha = 0.22f)))
            Column {
                TopLevel.entries.forEachIndexed { i, dest ->
                    val isSel = i == selected
                    Column(
                        Modifier.size(88.dp, itemH).selectable(isSel, role = Role.Tab, onClick = { onSelect(dest) }),
                        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center,
                    ) {
                        Icon(if (isSel) dest.selectedIcon else dest.icon, null, tint = if (isSel) c.primary else c.textMuted)
                        Text(dest.label, style = Kaze.type.overline, color = if (isSel) c.text else c.textMuted)
                    }
                }
            }
        }
    }
}
