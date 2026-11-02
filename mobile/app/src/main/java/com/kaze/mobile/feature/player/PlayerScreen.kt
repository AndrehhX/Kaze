package com.kaze.mobile.feature.player

import android.view.TextureView
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.VolumeOff
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.AspectRatio
import androidx.compose.material.icons.filled.Brightness6
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Fullscreen
import androidx.compose.material.icons.filled.FullscreenExit
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PictureInPictureAlt
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Replay10
import androidx.compose.material.icons.filled.Forward10
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.filled.Subtitles
import androidx.compose.material.icons.filled.Theaters
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.kaze.mobile.core.designsystem.components.KazeButton
import com.kaze.mobile.core.designsystem.components.KazeButtonKind
import com.kaze.mobile.core.designsystem.components.KazeCard
import com.kaze.mobile.core.designsystem.components.KazeChip
import com.kaze.mobile.core.designsystem.components.KazeIconButton
import com.kaze.mobile.core.designsystem.components.KazeSpinner
import com.kaze.mobile.core.designsystem.components.Pill
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.domain.playback.SkipKind
import kotlinx.coroutines.delay
import kotlin.math.roundToLong

data class PlayerChrome(
    val isFullscreen: Boolean,
    val isInPip: Boolean,
    val isWide: Boolean,
    val onToggleFullscreen: () -> Unit,
    val onEnterPip: () -> Unit,
    val onBack: () -> Unit,
    val onOpenAnime: () -> Unit,
    val adjustBrightness: (Float) -> Float,
    val adjustVolume: (Float) -> Float,
)

@Composable
fun PlayerScreen(vm: PlayerViewModel, chrome: PlayerChrome) {
    val ui by vm.ui.collectAsStateWithLifecycle()
    val prefs by vm.prefs.collectAsStateWithLifecycle()
    var controlsVisible by rememberSaveable { mutableStateOf(true) }
    var showSettings by rememberSaveable { mutableStateOf(false) }
    var showStats by rememberSaveable { mutableStateOf(false) }
    var theater by rememberSaveable { mutableStateOf(false) }
    var textureView by remember { mutableStateOf<TextureView?>(null) }
    var seekPreview by remember { mutableStateOf<Long?>(null) }
    var hud by remember { mutableStateOf<String?>(null) }
    var doubleTapFlash by remember { mutableStateOf<TapSide?>(null) }
    val focus = remember { FocusRequester() }

    // Auto-hide controls while playing.
    LaunchedEffect(controlsVisible, ui.isPlaying, showSettings) {
        if (controlsVisible && ui.isPlaying && !showSettings) { delay(3_500); controlsVisible = false }
    }
    LaunchedEffect(hud) { if (hud != null) { delay(900); hud = null } }
    LaunchedEffect(doubleTapFlash) { if (doubleTapFlash != null) { delay(500); doubleTapFlash = null } }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }

    val gestures = rememberGestureCallbacks(
        onTap = { controlsVisible = !controlsVisible },
        onDoubleTap = { side ->
            when (side) {
                TapSide.LEFT -> { vm.seekBy(-10_000); doubleTapFlash = side }
                TapSide.RIGHT -> { vm.seekBy(10_000); doubleTapFlash = side }
                TapSide.CENTER -> vm.togglePlay()
            }
        },
        onSeekDrag = { f ->
            val window = minOf(ui.durationMs, 120_000L).coerceAtLeast(30_000L)
            seekPreview = (ui.positionMs + (f * window).roundToLong()).coerceIn(0, ui.durationMs)
        },
        onSeekEnd = { seekPreview?.let(vm::seekTo); seekPreview = null },
        onBrightnessDrag = { d -> hud = "Brightness ${(chrome.adjustBrightness(d) * 100).toInt()}%" },
        onVolumeDrag = { d -> hud = "Volume ${(chrome.adjustVolume(d) * 100).toInt()}%" },
        onAdjustEnd = {},
        onPinch = { z -> if (z > 1.1f) vm.setFitMode(FitMode.FILL) else if (z < 0.9f) vm.setFitMode(FitMode.FIT); hud = "Video: ${vm.ui.value.fitMode.label}" },
        onLongPress = { pressed -> vm.setSpeedBoost(pressed) },
    )

    val keyHandler = Modifier.focusRequester(focus).focusable().onKeyEvent { e ->
        if (e.type != KeyEventType.KeyDown) return@onKeyEvent false
        when (e.key) {
            Key.Spacebar, Key.K, Key.MediaPlayPause -> { vm.togglePlay(); true }
            Key.DirectionLeft, Key.J -> { vm.seekBy(-10_000); true }
            Key.DirectionRight, Key.L -> { vm.seekBy(10_000); true }
            Key.F -> { chrome.onToggleFullscreen(); true }
            Key.M -> { vm.toggleMute(); true }
            Key.N, Key.MediaNext -> { vm.next(); true }
            Key.P, Key.MediaPrevious -> { vm.previous(); true }
            Key.C -> { showSettings = true; true }
            else -> false
        }
    }

    val immersive = chrome.isFullscreen || chrome.isInPip || (chrome.isWide && theater)
    val videoArea: @Composable (Modifier) -> Unit = { mod ->
        Box(mod.background(Color.Black)) {
            AmbientGlow(textureView, enabled = prefs?.ambientMode == true && !chrome.isInPip && !Kaze.reducedMotion, playing = ui.isPlaying, intensity = prefs?.ambientIntensity ?: 0.6f)
            KazeVideoSurface(
                player = vm.player, aspect = ui.videoAspect, fitMode = ui.fitMode,
                subtitleScale = prefs?.subtitleScale ?: 1f, subtitleBackground = prefs?.subtitleBackground ?: true,
                modifier = Modifier.fillMaxSize().playerGestures(!chrome.isInPip, gestures),
                onTextureView = { textureView = it },
            )
            if (!chrome.isInPip) {
                if (ui.buffering && ui.error == null) KazeSpinner(Modifier.align(Alignment.Center).size(48.dp), color = Color.White)
                doubleTapFlash?.let { side ->
                    Box(Modifier.align(if (side == TapSide.LEFT) Alignment.CenterStart else Alignment.CenterEnd).padding(32.dp).size(88.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.18f)), contentAlignment = Alignment.Center) {
                        Text(if (side == TapSide.LEFT) "−10s" else "+10s", color = Color.White, style = Kaze.type.title)
                    }
                }
                (seekPreview?.let { "${formatTime(it)} / ${formatTime(ui.durationMs)}" } ?: hud ?: if (ui.speedBoost) "2× speed — release to stop" else null)?.let { msg ->
                    Text(msg, color = Color.White, style = Kaze.type.title, modifier = Modifier.align(Alignment.TopCenter).padding(top = 56.dp).clip(Kaze.style.chipShape).background(Color.Black.copy(alpha = 0.6f)).padding(horizontal = 14.dp, vertical = 8.dp).semantics { liveRegion = LiveRegionMode.Polite })
                }
                AnimatedVisibility(controlsVisible || !ui.isPlaying, Modifier.fillMaxSize(), enter = fadeIn(tween(160)), exit = fadeOut(tween(220))) {
                    Controls(ui, vm, chrome, onSettings = { showSettings = true }, theater = theater, onTheater = { theater = !theater })
                }
                ui.activeSkip?.let { marker ->
                    KazeButton(
                        if (marker.kind == SkipKind.INTRO) "Skip intro" else "Skip credits", { vm.skip(marker) },
                        modifier = Modifier.align(Alignment.BottomEnd).padding(end = 20.dp, bottom = 88.dp),
                    )
                }
                ui.nextCountdown?.let { s -> NextEpisodeCard(s, ui.request?.episode?.plus(1) ?: 0, onPlay = { vm.cancelAutoNext(); vm.next() }, onCancel = vm::cancelAutoNext, modifier = Modifier.align(Alignment.BottomEnd).padding(20.dp)) }
                if (showStats) StatsOverlay(ui, Modifier.align(Alignment.TopStart).padding(top = 64.dp, start = 16.dp))
                ui.error?.let { err ->
                    Column(Modifier.align(Alignment.Center).padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(err, color = Color.White, style = Kaze.type.body)
                        Spacer(Modifier.height(12.dp))
                        KazeButton("Retry", vm::retry)
                    }
                }
            }
        }
    }

    BoxWithConstraints(Modifier.fillMaxSize().background(Color.Black).then(keyHandler)) {
        val maxVideoHeight = maxHeight * 0.45f
        when {
            immersive -> videoArea(Modifier.fillMaxSize())
            chrome.isWide -> Row(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
                videoArea(Modifier.weight(0.68f).fillMaxHeight())
                InfoPanel(ui, vm, chrome, Modifier.weight(0.32f).fillMaxHeight())
            }
            else -> Column(Modifier.fillMaxSize().background(Kaze.colors.background)) {
                Spacer(Modifier.windowInsetsPadding(WindowInsets.statusBars).background(Color.Black))
                videoArea(Modifier.fillMaxWidth().aspectRatio(16f / 9f).heightIn(max = maxVideoHeight))
                InfoPanel(ui, vm, chrome, Modifier.weight(1f))
            }
        }
    }

    if (showSettings) PlayerSettingsSheet(ui, vm, showStats, { showStats = it }, onDismiss = { showSettings = false })
}

@Composable
private fun Controls(ui: PlayerUi, vm: PlayerViewModel, chrome: PlayerChrome, onSettings: () -> Unit, theater: Boolean, onTheater: () -> Unit) {
    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color.Black.copy(alpha = 0.65f), 0.3f to Color.Transparent, 0.7f to Color.Transparent, 1f to Color.Black.copy(alpha = 0.75f)))) {
        Row(Modifier.fillMaxWidth().align(Alignment.TopStart).padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
            KazeIconButton(Icons.AutoMirrored.Filled.ArrowBack, "Cerrar reproductor", chrome.onBack, tint = Color.White)
            Column(Modifier.weight(1f)) {
                Text(ui.request?.title ?: "", color = Color.White, style = Kaze.type.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("EP ${ui.request?.episode ?: ""}${if (ui.source?.mediaTitle != null) " · " + ui.source?.mediaTitle else ""}", color = Color.White.copy(alpha = 0.8f), style = Kaze.type.bodySmall, maxLines = 1)
            }
            KazeIconButton(if (ui.muted) Icons.AutoMirrored.Filled.VolumeOff else Icons.AutoMirrored.Filled.VolumeUp, if (ui.muted) "Activar sonido" else "Silenciar", vm::toggleMute, tint = Color.White)
            KazeIconButton(Icons.Filled.PictureInPictureAlt, "Ventana flotante (PiP)", chrome.onEnterPip, tint = Color.White)
            KazeIconButton(Icons.Filled.Settings, "Ajustes de reproducción", onSettings, tint = Color.White)
        }
        Row(Modifier.align(Alignment.Center), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(18.dp)) {
            KazeIconButton(Icons.Filled.SkipPrevious, "Episodio anterior", vm::previous, tint = Color.White, enabled = ui.hasPrevious)
            KazeIconButton(Icons.Filled.Replay10, "Retroceder 10 segundos", { vm.seekBy(-10_000) }, tint = Color.White)
            Box(
                Modifier.size(72.dp).clip(CircleShape).background(Kaze.colors.primary.copy(alpha = 0.92f)),
                contentAlignment = Alignment.Center,
            ) {
                KazeIconButton(if (ui.isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow, if (ui.isPlaying) "Pausar" else "Reproducir", vm::togglePlay, tint = Kaze.colors.onPrimary)
            }
            KazeIconButton(Icons.Filled.Forward10, "Adelantar 10 segundos", { vm.seekBy(10_000) }, tint = Color.White)
            KazeIconButton(Icons.Filled.SkipNext, "Siguiente episodio", vm::next, tint = Color.White, enabled = ui.hasNext)
        }
        Column(Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp)) {
            SeekBar(ui, vm::seekTo)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("${formatTime(ui.positionMs)} / ${formatTime(ui.durationMs)}", color = Color.White, style = Kaze.type.label)
                if (ui.speed != 1f) Pill("${ui.speed}×", Modifier.padding(start = 8.dp), color = Color.White)
                Spacer(Modifier.weight(1f))
                KazeIconButton(Icons.Filled.AspectRatio, "Ajuste de pantalla: ${ui.fitMode.label}", vm::cycleFitMode, tint = Color.White)
                if (chrome.isWide) KazeIconButton(Icons.Filled.Theaters, if (theater) "Salir de modo cine" else "Modo cine", onTheater, tint = Color.White)
                KazeIconButton(if (chrome.isFullscreen) Icons.Filled.FullscreenExit else Icons.Filled.Fullscreen, if (chrome.isFullscreen) "Salir de pantalla completa" else "Pantalla completa", chrome.onToggleFullscreen, tint = Color.White)
            }
        }
    }
}

@Composable
private fun SeekBar(ui: PlayerUi, onSeek: (Long) -> Unit) {
    var scrub by remember { mutableStateOf<Float?>(null) }
    val dur = ui.durationMs.coerceAtLeast(1)
    val value = scrub ?: (ui.positionMs.toFloat() / dur)
    Box(contentAlignment = Alignment.Center) {
        Box(Modifier.fillMaxWidth().padding(horizontal = 10.dp).height(3.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.2f))) {
            Box(Modifier.fillMaxWidth((ui.bufferedMs.toFloat() / dur).coerceIn(0f, 1f)).height(3.dp).background(Color.White.copy(alpha = 0.45f)))
        }
        Slider(
            value = value.coerceIn(0f, 1f),
            onValueChange = { scrub = it },
            onValueChangeFinished = { scrub?.let { onSeek((it * dur).toLong()) }; scrub = null },
            colors = SliderDefaults.colors(thumbColor = Kaze.colors.primary, activeTrackColor = Kaze.colors.primary, inactiveTrackColor = Color.Transparent),
            modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Seek. ${formatTime(ui.positionMs)} of ${formatTime(ui.durationMs)}" },
        )
    }
}

@Composable
private fun NextEpisodeCard(seconds: Int, episode: Int, onPlay: () -> Unit, onCancel: () -> Unit, modifier: Modifier) {
    AnimatedVisibility(true, modifier, enter = scaleIn() + fadeIn(), exit = scaleOut() + fadeOut()) {
        KazeCard(Modifier.width(260.dp), highlighted = true) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Episodio $episode en $seconds…", style = Kaze.type.title, color = Kaze.colors.text, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    KazeButton("Reproducir ahora", onPlay, modifier = Modifier.weight(1f))
                    KazeButton("Cancel", onCancel, kind = KazeButtonKind.Secondary)
                }
            }
        }
    }
}

@Composable
private fun StatsOverlay(ui: PlayerUi, modifier: Modifier) {
    val s = ui.stats
    Column(modifier.clip(Kaze.style.cardShape).background(Color.Black.copy(alpha = 0.7f)).padding(12.dp)) {
        listOf(
            "Resolución" to s.resolution,
            "Tasa de bits de video" to (s.videoBitrateKbps?.let { "$it kbps" } ?: "—"),
            "Velocidad de red" to (s.bandwidthEstimateKbps?.let { "$it kbps" } ?: "—"),
            "Búfer cargado" to "%.1f s".format(s.bufferAheadMs / 1000f),
            "Cuadros perdidos" to "${s.droppedFrames}",
            "Códec de video" to (s.videoCodec ?: "—"),
            "Códec de audio" to (s.audioCodec ?: "—"),
            "Modo de calidad" to if (ui.autoQuality) "Adaptativa (auto)" else "Manual",
        ).forEach { (k, v) -> Text("$k: $v", color = Color.White, style = Kaze.type.bodySmall) }
    }
}

@Composable
private fun InfoPanel(ui: PlayerUi, vm: PlayerViewModel, chrome: PlayerChrome, modifier: Modifier) {
    val c = Kaze.colors
    val r = ui.request
    Column(
        modifier.background(c.background).verticalScroll(rememberScrollState()).windowInsetsPadding(WindowInsets.navigationBars).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(r?.title ?: "", style = Kaze.type.headline, color = c.text)
        Text("Episodio ${r?.episode ?: ""}" + (r?.totalEpisodes?.let { " de $it" } ?: ""), style = Kaze.type.body, color = c.textMuted)
        ui.source?.demoNotice?.let { notice ->
            KazeCard(Modifier.fillMaxWidth()) {
                Row {
                    Icon(Icons.Filled.Info, null, tint = c.accent)
                    Spacer(Modifier.width(10.dp))
                    Column {
                        Text(notice, style = Kaze.type.bodySmall, color = c.text)
                        Spacer(Modifier.height(4.dp))
                        Text(ui.source.attribution, style = Kaze.type.bodySmall, color = c.textMuted)
                    }
                }
            }
        }
        ui.resumedFromMs?.let { Text("Reanudado desde ${formatTime(it)}", style = Kaze.type.bodySmall, color = c.primary) }
        val downloads by vm.downloadRepo.downloads.collectAsStateWithLifecycle()
        val isDownloaded = remember(downloads, ui.request) {
            ui.request?.let { req -> downloads.any { it.id == "${req.animeId}:${req.episode}" && it.status == com.kaze.mobile.data.playback.DownloadStatus.COMPLETED } } ?: false
        }
        val isDownloading = remember(downloads, ui.request) {
            ui.request?.let { req -> downloads.any { it.id == "${req.animeId}:${req.episode}" && it.status == com.kaze.mobile.data.playback.DownloadStatus.DOWNLOADING } } ?: false
        }

        // Selector de audio: Japonés SUB vs Español Latino DUB
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Audio:", style = Kaze.type.bodySmall, color = c.textMuted)
            KazeChip("🇯🇵 Japonés (SUB)", selected = ui.currentAudioOption == "sub", onClick = { vm.switchAudio("sub") })
            if (ui.isDubbedAvailable || ui.source?.isDubbedAvailable == true) {
                KazeChip("🇲🇽 Latino (DUB)", selected = ui.currentAudioOption == "latino", onClick = { vm.switchAudio("latino") })
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            KazeButton("Anterior", vm::previous, icon = Icons.Filled.SkipPrevious, kind = KazeButtonKind.Secondary, enabled = ui.hasPrevious)
            KazeButton("Siguiente", vm::next, icon = Icons.Filled.SkipNext, enabled = ui.hasNext, modifier = Modifier.weight(1f))
            KazeButton(
                if (isDownloaded) "Descargado" else if (isDownloading) "Descargando…" else "Descargar",
                onClick = { if (!isDownloaded && !isDownloading) vm.downloadCurrentEpisode() },
                icon = if (isDownloaded) Icons.Filled.CheckCircle else Icons.Filled.Download,
                kind = if (isDownloaded) KazeButtonKind.Ghost else KazeButtonKind.Secondary,
                enabled = !isDownloaded && !isDownloading
            )
        }
        KazeButton("Ver página del anime", chrome.onOpenAnime, kind = KazeButtonKind.Ghost)
        Text("Controles y gestos", style = Kaze.type.title, color = c.text)
        Text(
            "Doble toque izq/der: ∓10 s · Deslizar horizontal: adelantar/retroceder · Deslizar vertical izq: brillo, der: volumen · Pellizcar: ajustar pantalla · Mantener presionado: velocidad 2×.",
            style = Kaze.type.bodySmall, color = c.textMuted,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            KazeIconButton(Icons.Filled.Brightness6, "Aumentar brillo", { chrome.adjustBrightness(0.1f) }, background = c.surfaceHigh)
            KazeIconButton(Icons.AutoMirrored.Filled.VolumeUp, "Aumentar volumen", { chrome.adjustVolume(0.1f) }, background = c.surfaceHigh)
            KazeIconButton(Icons.Filled.Subtitles, "Subtítulos y audio", { vm.selectText(ui.textTracks.firstOrNull { !it.selected } ?: ui.textTracks.firstOrNull()) }, background = c.surfaceHigh)
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun PlayerSettingsSheet(ui: PlayerUi, vm: PlayerViewModel, showStats: Boolean, onStats: (Boolean) -> Unit, onDismiss: () -> Unit) {
    val c = Kaze.colors
    val prefs by vm.prefs.collectAsStateWithLifecycle()
    ModalBottomSheet(onDismiss, containerColor = c.surface, shape = Kaze.style.sheetShape) {
        Column(Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Audio y doblaje", style = Kaze.type.title, color = c.text)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                KazeChip("🇯🇵 Japonés (SUB)", selected = ui.currentAudioOption == "sub", onClick = { vm.switchAudio("sub") })
                if (ui.isDubbedAvailable || ui.source?.isDubbedAvailable == true) {
                    KazeChip("🇲🇽 Español Latino (DUB)", selected = ui.currentAudioOption == "latino", onClick = { vm.switchAudio("latino") })
                }
            }
            Text("Calidad", style = Kaze.type.title, color = c.text)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                KazeChip("Automático" + (if (ui.autoQuality) " · ${ui.stats.resolution}" else ""), selected = ui.autoQuality, onClick = { vm.selectQuality(null) })
                ui.qualities.forEach { q -> KazeChip(q.label, selected = !ui.autoQuality && q.selected, onClick = { vm.selectQuality(q) }) }
            }
            if (ui.audioTracks.size > 1) {
                Text("Pista de audio", style = Kaze.type.title, color = c.text)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    ui.audioTracks.forEach { a -> KazeChip(a.label, selected = a.selected, onClick = { vm.selectAudio(a) }) }
                }
            }
            Text("Subtítulos", style = Kaze.type.title, color = c.text)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                KazeChip("Desactivados", selected = ui.subtitlesOff || ui.textTracks.none { it.selected }, onClick = { vm.selectText(null) })
                ui.textTracks.forEach { t -> KazeChip(t.label, selected = !ui.subtitlesOff && t.selected, onClick = { vm.selectText(t) }) }
            }
            if (ui.textTracks.isEmpty()) Text("This demo stream has no subtitle tracks.", style = Kaze.type.bodySmall, color = c.textMuted)
            Text("Velocidad", style = Kaze.type.title, color = c.text)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf(0.5f, 0.75f, 1f, 1.25f, 1.5f, 1.75f, 2f).forEach { s -> KazeChip("${s}×", selected = ui.speed == s, onClick = { vm.setSpeed(s) }) }
            }
            Text("Ajuste de pantalla", style = Kaze.type.title, color = c.text)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { FitMode.entries.forEach { f -> KazeChip(f.label, selected = ui.fitMode == f, onClick = { vm.setFitMode(f) }) } }
            Text("Tamaño de subtítulos: ${((prefs?.subtitleScale ?: 1f) * 100).toInt()}%", style = Kaze.type.title, color = c.text)
            var scale by remember(prefs?.subtitleScale) { mutableFloatStateOf(prefs?.subtitleScale ?: 1f) }
            Slider(scale, { scale = it }, valueRange = 0.6f..2f, onValueChangeFinished = { vm.setSubtitleScale(scale) }, colors = SliderDefaults.colors(thumbColor = c.primary, activeTrackColor = c.primary))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Modo ambiente", style = Kaze.type.body, color = c.text, modifier = Modifier.weight(1f))
                KazeChip(if (prefs?.ambientMode == true) "Activado" else "Desactivado", selected = prefs?.ambientMode == true, onClick = { vm.setAmbient(!(prefs?.ambientMode ?: false)) })
            }
            if (prefs?.ambientMode == true) {
                var amb by remember(prefs?.ambientIntensity) { mutableFloatStateOf(prefs?.ambientIntensity ?: 0.6f) }
                Slider(amb, { amb = it }, valueRange = 0f..1f, onValueChangeFinished = { vm.setAmbientIntensity(amb) }, colors = SliderDefaults.colors(thumbColor = c.primary, activeTrackColor = c.primary), modifier = Modifier.semantics { contentDescription = "Ambient intensity" })
                Text("Ambient lighting pauses automatically in battery saver and when reduce-motion is on.", style = Kaze.type.bodySmall, color = c.textMuted)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Estadísticas técnicas", style = Kaze.type.body, color = c.text, modifier = Modifier.weight(1f))
                KazeChip(if (showStats) "Activado" else "Desactivado", selected = showStats, onClick = { onStats(!showStats) })
            }
            ui.source?.skipMarkers?.takeIf { it.isNotEmpty() }?.let { m -> Text("Skip markers: ${m.first().source} (hand-authored for this demo film).", style = Kaze.type.bodySmall, color = c.textMuted) }
        }
    }
}

