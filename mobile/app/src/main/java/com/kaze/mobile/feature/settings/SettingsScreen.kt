package com.kaze.mobile.feature.settings

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.PrivacyTip
import androidx.compose.material3.Icon
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.kaze.mobile.BuildConfig
import com.kaze.mobile.core.designsystem.components.KazeButton
import com.kaze.mobile.core.designsystem.components.KazeButtonKind
import com.kaze.mobile.core.designsystem.components.KazeTopBar
import com.kaze.mobile.core.designsystem.components.SectionHeader
import com.kaze.mobile.core.designsystem.theme.Kaze
import kotlin.math.roundToInt

@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    onAppearance: () -> Unit,
    onPrivacy: (() -> Unit)?,
    onConnected: (() -> Unit)?,
    onAccount: (() -> Unit)?,
    vm: SettingsViewModel = hiltViewModel(),
) {
    val p by vm.state.collectAsStateWithLifecycle()
    val prefs = p ?: return
    val c = Kaze.colors
    val context = LocalContext.current
    var cacheCleared by remember { mutableStateOf(false) }
    var permissionGranted by remember {
        mutableStateOf(Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
    }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { permissionGranted = it }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        KazeTopBar("Ajustes", onBack)
        NavRow(Icons.Filled.Palette, "Apariencia", "${prefs.theme.label}${if (prefs.followSystem) " · sigue al sistema" else ""}", onAppearance)
        onAccount?.let { NavRow(Icons.Filled.AccountCircle, "Cuenta", "Iniciar sesión, sesiones, seguridad", it) }
        onConnected?.let { NavRow(Icons.Filled.Link, "Cuentas vinculadas", "Sincronización de AniList", it) }
        onPrivacy?.let { NavRow(Icons.Filled.PrivacyTip, "Privacidad", "Visibilidad de perfil y actividad", it) }

        SectionHeader("Reproducción")
        ToggleRow("Reproducir siguiente automáticamente", "Con cuenta regresiva cancelable", prefs.autoNext, vm::setAutoNext)
        ToggleRow("Saltar intro automáticamente", "Solo donde existan marcadores", prefs.skipIntroAutomatically, vm::setSkipIntro)
        ToggleRow("Modo ambiente", "El fondo brilla con los colores del video", prefs.ambientMode, vm::setAmbientMode)
        if (prefs.ambientMode) LabeledSlider("Intensidad del modo ambiente", prefs.ambientIntensity, 0f..1f, { "${(it * 100).roundToInt()}%" }, vm::setAmbientIntensity)
        LabeledSlider("Tamaño de subtítulos", prefs.subtitleScale, 0.6f..2f, { "${(it * 100).roundToInt()}%" }, vm::setSubtitleScale)
        ToggleRow("Fondo oscuro en subtítulos", "Caja oscura detrás del texto para mayor legibilidad", prefs.subtitleBackground, vm::setSubtitleBackground)

        SectionHeader("Notificaciones")
        if (!permissionGranted && Build.VERSION.SDK_INT >= 33) {
            Column(Modifier.padding(horizontal = 20.dp)) {
                Text("Android needs your permission before KAZE can notify you.", style = Kaze.type.bodySmall, color = c.textMuted)
                KazeButton("Allow notifications", { permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS) }, kind = KazeButtonKind.Secondary)
            }
        }
        ToggleRow("New episodes", "For anime you're watching (AniList airing schedule)", prefs.notifyEpisodes, vm::setNotifyEpisodes)
        ToggleRow("Friends & replies", "Requests, accepted requests, replies, reactions", prefs.notifySocial, vm::setNotifySocial)
        ToggleRow("Invitaciones a salas compartidas", null, prefs.notifyParties, vm::setNotifyParties)

        SectionHeader("Extras")
        ToggleRow("Achievements", "Optional milestones from real activity. No streaks, no nagging.", prefs.gamificationEnabled, vm::setGamification)
        Row(Modifier.padding(horizontal = 20.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(if (cacheCleared) "Cache cleared" else "Limpiar caché del catálogo", style = Kaze.type.body, color = c.text, modifier = Modifier.weight(1f))
            KazeButton("Limpiar", { vm.clearCache { cacheCleared = true } }, kind = KazeButtonKind.Secondary, enabled = !cacheCleared)
        }

        SectionHeader("About")
        Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(6.dp)) {
            Text("KAZE ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})", style = Kaze.type.body, color = c.text)
            Text("Anime metadata, artwork references and reviews © their owners, provided by the AniList API.", style = Kaze.type.bodySmall, color = c.textMuted)
            Text("Demo playback uses openly licensed Blender Foundation films (CC BY 3.0) served from public test streams. KAZE does not host or stream anime episodes.", style = Kaze.type.bodySmall, color = c.textMuted)
            Text("Backend: " + if (BuildConfig.SUPABASE_URL.isNotBlank()) "configured" else "not configured (guest mode)", style = Kaze.type.bodySmall, color = c.textMuted)
        }
        Spacer(Modifier.height(120.dp))
    }
}

@Composable
fun NavRow(icon: ImageVector, title: String, subtitle: String?, onClick: () -> Unit) {
    val c = Kaze.colors
    Row(
        Modifier.fillMaxWidth().clickable(role = Role.Button, onClickLabel = title, onClick = onClick).padding(horizontal = 20.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = c.primary)
        Spacer(Modifier.width(16.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = Kaze.type.body, color = c.text)
            if (subtitle != null) Text(subtitle, style = Kaze.type.bodySmall, color = c.textMuted)
        }
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = c.textMuted)
    }
}

@Composable
fun LabeledSlider(label: String, value: Float, range: ClosedFloatingPointRange<Float>, format: (Float) -> String, onChange: (Float) -> Unit) {
    val c = Kaze.colors
    var local by remember(value) { mutableStateOf(value) }
    Column(Modifier.padding(horizontal = 20.dp)) {
        Text("$label: ${format(local)}", style = Kaze.type.body, color = c.text)
        Slider(
            local, { local = it }, valueRange = range, onValueChangeFinished = { onChange(local) },
            colors = SliderDefaults.colors(thumbColor = c.primary, activeTrackColor = c.primary),
            modifier = Modifier.semantics { contentDescription = label },
        )
    }
}
