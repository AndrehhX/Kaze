package com.kaze.mobile.feature.settings

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.CleaningServices
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.filled.PrivacyTip
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.kaze.mobile.BuildConfig
import com.kaze.mobile.core.designsystem.components.KazeTopBar
import com.kaze.mobile.core.designsystem.theme.Kaze
import kotlin.math.abs

/**
 * Ajustes ordenados en tarjetas por tema. Las mismas opciones de antes, pero cada grupo
 * tiene su título e icono, y los deslizadores pasaron a selectores de pocas opciones claras.
 */
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

        SettingsGroup("Tu cuenta", Icons.Filled.AccountCircle) {
            NavItem(Icons.Filled.Palette, "Apariencia", prefs.theme.label + if (prefs.followSystem) " · sigue al sistema" else "", onAppearance)
            onAccount?.let { NavItem(Icons.Filled.AccountCircle, "Cuenta", "Sesión, contraseña y seguridad", it) }
            onConnected?.let { NavItem(Icons.Filled.Link, "Cuentas vinculadas", "AniList", it) }
            onPrivacy?.let { NavItem(Icons.Filled.PrivacyTip, "Privacidad", "Quién ve tu perfil y actividad", it) }
        }

        SettingsGroup("Reproducción", Icons.Filled.PlayCircle) {
            SwitchItem("Siguiente episodio automático", "Con una cuenta atrás que puedes cancelar", prefs.autoNext, vm::setAutoNext)
            SwitchItem("Saltar intro solo", "Cuando el episodio tiene marcas de intro", prefs.skipIntroAutomatically, vm::setSkipIntro)
            SwitchItem("Modo cine", "Luz de colores alrededor del video", prefs.ambientMode, vm::setAmbientMode)
            if (prefs.ambientMode) ChoiceItem(
                "Intensidad del modo cine", listOf(0.3f to "Suave", 0.6f to "Media", 0.9f to "Fuerte"),
                listOf(0.3f, 0.6f, 0.9f).minBy { abs(it - prefs.ambientIntensity) }, vm::setAmbientIntensity,
            )
            ChoiceItem(
                "Tamaño de subtítulos", listOf(0.8f to "Chico", 1f to "Normal", 1.3f to "Grande", 1.6f to "Enorme"),
                listOf(0.8f, 1f, 1.3f, 1.6f).minBy { abs(it - prefs.subtitleScale) }, vm::setSubtitleScale,
            )
            SwitchItem("Fondo oscuro en subtítulos", "Se leen mejor en escenas claras", prefs.subtitleBackground, vm::setSubtitleBackground)
        }

        SettingsGroup("Descargas", Icons.Filled.Download) {
            SwitchItem("Solo con Wi-Fi", "No gasta tus datos móviles", prefs.downloadWifiOnly, vm::setDownloadWifiOnly)
            ChoiceItem("Calidad de descarga", listOf(480 to "480p", 720 to "720p", 1080 to "1080p"), prefs.downloadQuality, vm::setDownloadQuality)
            SwitchItem("Descarga inteligente", "Al terminar un episodio descargado, baja el siguiente y borra el que ya viste", prefs.smartDownloads, vm::setSmartDownloads)
        }

        SettingsGroup("Notificaciones", Icons.Filled.Notifications) {
            if (!permissionGranted && Build.VERSION.SDK_INT >= 33) {
                Row(
                    Modifier.fillMaxWidth().clickable(role = Role.Button) { permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS) }
                        .background(c.primary.copy(alpha = 0.12f)).padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Android necesita tu permiso para avisarte", style = Kaze.type.bodySmall, color = c.text, modifier = Modifier.weight(1f))
                    Text("Permitir", style = Kaze.type.titleSmall, color = c.primary)
                }
            }
            SwitchItem("Episodios nuevos", "Cuando sale un capítulo de lo que vas al día", prefs.notifyEpisodes, vm::setNotifyEpisodes)
            SwitchItem("Amigos y respuestas", "Solicitudes, respuestas y reacciones", prefs.notifySocial, vm::setNotifySocial)
            SwitchItem("Invitaciones a salas", "Cuando te invitan a ver juntos", prefs.notifyParties, vm::setNotifyParties)
        }

        SettingsGroup("Más", Icons.Filled.Tune) {
            SwitchItem("Logros", "Metas opcionales según lo que ves. Sin rachas ni presión.", prefs.gamificationEnabled, vm::setGamification, icon = Icons.Filled.EmojiEvents)
            Row(
                Modifier.fillMaxWidth().clickable(enabled = !cacheCleared, role = Role.Button) { vm.clearCache { cacheCleared = true } }.padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Filled.CleaningServices, null, tint = c.primary, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    Text("Limpiar caché del catálogo", style = Kaze.type.body, color = c.text)
                    Text(if (cacheCleared) "Listo, se volverá a cargar" else "Si algo se ve desactualizado", style = Kaze.type.bodySmall, color = c.textMuted)
                }
            }
        }

        Text(
            "KAZE ${BuildConfig.VERSION_NAME} · Datos de anime de AniList",
            style = Kaze.type.bodySmall, color = c.textMuted, textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().padding(top = 20.dp),
        )
        Spacer(Modifier.height(120.dp))
    }
}

/** Grupo de ajustes: título con icono y una tarjeta con sus filas separadas por líneas finas. */
@Composable
private fun SettingsGroup(title: String, icon: ImageVector, content: @Composable ColumnScope.() -> Unit) {
    val c = Kaze.colors
    Row(Modifier.padding(start = 24.dp, end = 24.dp, top = 20.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = c.primary, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(8.dp))
        Text(if (Kaze.style.uppercaseLabels) title.uppercase() else title, style = Kaze.type.titleSmall, color = c.text)
    }
    Column(Modifier.padding(horizontal = 16.dp).fillMaxWidth().clip(Kaze.style.cardShape).background(c.surfaceHigh)) {
        content()
    }
}

@Composable
private fun Divider() = Box(Modifier.padding(start = 16.dp).fillMaxWidth().height(1.dp).background(Kaze.colors.text.copy(alpha = 0.06f)))

@Composable
private fun NavItem(icon: ImageVector, title: String, subtitle: String?, onClick: () -> Unit) {
    val c = Kaze.colors
    Row(
        Modifier.fillMaxWidth().clickable(role = Role.Button, onClickLabel = title, onClick = onClick).padding(horizontal = 16.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = c.primary, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = Kaze.type.body, color = c.text)
            if (!subtitle.isNullOrBlank()) Text(subtitle, style = Kaze.type.bodySmall, color = c.textMuted)
        }
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = c.textMuted)
    }
}

@Composable
private fun SwitchItem(title: String, subtitle: String?, checked: Boolean, onChange: (Boolean) -> Unit, icon: ImageVector? = null) {
    val c = Kaze.colors
    Row(
        Modifier.fillMaxWidth().clickable(role = Role.Switch, onClickLabel = title) { onChange(!checked) }.padding(horizontal = 16.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) { Icon(icon, null, tint = c.primary, modifier = Modifier.size(20.dp)); Spacer(Modifier.width(14.dp)) }
        Column(Modifier.weight(1f)) {
            Text(title, style = Kaze.type.body, color = c.text)
            if (subtitle != null) Text(subtitle, style = Kaze.type.bodySmall, color = c.textMuted)
        }
        Spacer(Modifier.width(12.dp))
        Switch(checked, null, colors = SwitchDefaults.colors(checkedThumbColor = c.onPrimary, checkedTrackColor = c.primary, uncheckedBorderColor = c.textMuted.copy(alpha = 0.4f)))
    }
}

/** Pocas opciones claras en una pastilla (en vez de un deslizador). */
@Composable
private fun <T> ChoiceItem(title: String, options: List<Pair<T, String>>, selected: T, onSelect: (T) -> Unit) {
    val c = Kaze.colors
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 11.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, style = Kaze.type.body, color = c.text)
        Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(50)).background(c.surface).padding(3.dp)) {
            options.forEach { (value, label) ->
                val sel = value == selected
                Text(
                    label, style = Kaze.type.label, color = if (sel) c.onPrimary else c.text, textAlign = TextAlign.Center,
                    modifier = Modifier.weight(1f).clip(RoundedCornerShape(50)).background(if (sel) c.primary else Color.Transparent)
                        .clickable(role = Role.RadioButton, onClickLabel = label) { onSelect(value) }.padding(vertical = 8.dp),
                )
            }
        }
    }
}

// Se mantienen para otras pantallas (Apariencia, Privacidad…) que los usan.
@Composable
fun NavRow(icon: ImageVector, title: String, subtitle: String?, onClick: () -> Unit) = NavItem(icon, title, subtitle, onClick)
