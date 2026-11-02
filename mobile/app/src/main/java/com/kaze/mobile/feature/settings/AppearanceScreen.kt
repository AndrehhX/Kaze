package com.kaze.mobile.feature.settings

import android.os.Build
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.kaze.mobile.core.designsystem.components.KazeButton
import com.kaze.mobile.core.designsystem.components.KazeChip
import com.kaze.mobile.core.designsystem.components.KazeTopBar
import com.kaze.mobile.core.designsystem.components.SectionHeader
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.core.designsystem.theme.KazeBackdrop
import com.kaze.mobile.core.designsystem.theme.KazeTheme
import com.kaze.mobile.core.designsystem.theme.KazeThemeId

@Composable
fun AppearanceScreen(onBack: () -> Unit, vm: SettingsViewModel = hiltViewModel()) {
    val p by vm.state.collectAsStateWithLifecycle()
    val prefs = p ?: return
    val c = Kaze.colors
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        KazeTopBar("Apariencia", onBack, subtitle = "Cuatro mundos. Un solo KAZE.")
        Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            KazeThemeId.entries.chunked(2).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    row.forEach { id ->
                        ThemePreviewCard(id, selected = !prefs.followSystem && prefs.theme == id, Modifier.weight(1f)) { vm.setTheme(id); vm.setFollowSystem(false) }
                    }
                }
            }
        }
        SectionHeader("Apariencia del sistema")
        ToggleRow("Seguir modo claro/oscuro del sistema", "Use ${prefs.darkTheme.label} when the system is dark and ${prefs.lightTheme.label} when it's light", prefs.followSystem, vm::setFollowSystem)
        if (prefs.followSystem) {
            Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Tema oscuro", style = Kaze.type.label, color = c.textMuted)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    KazeThemeId.entries.filter { it.isDark }.forEach { KazeChip(it.label, selected = prefs.darkTheme == it, onClick = { vm.setTheme(it); vm.setFollowSystem(true) }) }
                }
                Text("Tema claro", style = Kaze.type.label, color = c.textMuted)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    KazeThemeId.entries.filter { !it.isDark }.forEach { KazeChip(it.label, selected = prefs.lightTheme == it, onClick = { vm.setTheme(it); vm.setFollowSystem(true) }) }
                }
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ToggleRow("Material You accent", "Tint the theme's primary colour from your wallpaper", prefs.wallpaperAccent, vm::setWallpaperAccent)
        }
        SectionHeader("Motion & accessibility")
        ToggleRow("Reduce motion", "Replace transitions with instant changes and stop ambient animation", prefs.reducedMotion, vm::setReducedMotion)
        ToggleRow("Ambient effects", "Sakura petals, neon pulse, cyber scanlines", prefs.ambientEffects, vm::setAmbientEffects)
        ToggleRow("High contrast", "Stronger secondary text and outlines", prefs.highContrast, vm::setHighContrast)
        Text(
            "Text size follows your system font scale. Reduce motion is also enabled automatically when Android's animations are turned off.",
            style = Kaze.type.bodySmall, color = c.textMuted, modifier = Modifier.padding(20.dp),
        )
        Spacer(Modifier.height(100.dp))
    }
}

/** Interactive preview: each card renders real KAZE components inside that theme. */
@Composable
fun ThemePreviewCard(id: KazeThemeId, selected: Boolean, modifier: Modifier = Modifier, onSelect: () -> Unit) {
    val scale by animateFloatAsState(if (selected) 1f else 0.96f, spring(0.6f, Spring.StiffnessMediumLow), label = "theme-card")
    val outer = Kaze.colors
    Box(
        modifier
            .graphicsLayer { scaleX = scale; scaleY = scale }
            .clip(Kaze.style.cardShape)
            .border(if (selected) 3.dp else 1.dp, if (selected) outer.primary else outer.outline, Kaze.style.cardShape)
            .clickable(role = Role.RadioButton, onClickLabel = "Use ${id.label} theme", onClick = onSelect)
            .semantics { this.selected = selected; contentDescription = "${id.label}: ${id.tagline}" }
    ) {
        KazeTheme(themeId = id, ambientEffects = false) {
            val c = Kaze.colors
            Box(Modifier.fillMaxWidth().aspectRatio(0.78f)) {
                KazeBackdrop(Modifier.fillMaxSize())
                Column(Modifier.fillMaxSize().padding(10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(id.label, style = Kaze.type.titleSmall, color = c.text)
                    Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        repeat(3) { i ->
                            Box(
                                Modifier.weight(1f).aspectRatio(0.7f).clip(Kaze.style.posterShape)
                                    .background(Brush.verticalGradient(listOf(listOf(c.primary, c.secondary, c.accent)[i].copy(alpha = 0.7f), c.surfaceHigh)))
                            )
                        }
                    }
                    Box(Modifier.fillMaxWidth().height(8.dp).clip(Kaze.style.chipShape).background(c.text.copy(alpha = 0.15f)))
                    Box(Modifier.fillMaxWidth(0.6f).height(8.dp).clip(Kaze.style.chipShape).background(c.text.copy(alpha = 0.1f)))
                    Spacer(Modifier.weight(1f))
                    KazeButton("Watch", {}, minHeight = 32.dp, modifier = Modifier.fillMaxWidth())
                    Text(id.tagline, style = Kaze.type.bodySmall, color = c.textMuted, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                }
                if (selected) Icon(Icons.Filled.CheckCircle, null, tint = c.accent, modifier = Modifier.align(Alignment.TopEnd).padding(8.dp).size(22.dp).clip(CircleShape))
            }
        }
    }
}

@Composable
fun ToggleRow(title: String, subtitle: String?, checked: Boolean, onChange: (Boolean) -> Unit, enabled: Boolean = true) {
    val c = Kaze.colors
    Row(
        Modifier.fillMaxWidth()
            .clickable(enabled = enabled, role = Role.Switch, onClickLabel = title) { onChange(!checked) }
            .padding(horizontal = 20.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, style = Kaze.type.body, color = c.text.copy(alpha = if (enabled) 1f else 0.5f))
            if (subtitle != null) Text(subtitle, style = Kaze.type.bodySmall, color = c.textMuted)
        }
        Spacer(Modifier.width(12.dp))
        Switch(checked, null, enabled = enabled, colors = SwitchDefaults.colors(checkedTrackColor = c.primary, checkedThumbColor = c.onPrimary))
    }
}
