package com.kaze.mobile.feature.player

import android.content.Intent
import android.view.TextureView
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.DownloadDone
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Downloading
import androidx.compose.material.icons.filled.Forward10
import androidx.compose.material.icons.filled.Fullscreen
import androidx.compose.material.icons.filled.FullscreenExit
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PictureInPictureAlt
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Replay10
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.Theaters
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.ripple
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
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.kaze.mobile.core.designsystem.components.AnimeImage
import com.kaze.mobile.core.designsystem.components.KazeButton
import com.kaze.mobile.core.designsystem.components.KazeButtonKind
import com.kaze.mobile.core.designsystem.components.KazeCard
import com.kaze.mobile.core.designsystem.components.KazeIconButton
import com.kaze.mobile.core.designsystem.components.KazeSpinner
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.data.playback.DownloadStatus
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

    // Los controles se ocultan solos mientras se reproduce.
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
        onBrightnessDrag = { d -> hud = "Brillo ${(chrome.adjustBrightness(d) * 100).toInt()}%" },
        onVolumeDrag = { d -> hud = "Volumen ${(chrome.adjustVolume(d) * 100).toInt()}%" },
        onAdjustEnd = {},
        onPinch = { z -> if (z > 1.1f) vm.setFitMode(FitMode.FILL) else if (z < 0.9f) vm.setFitMode(FitMode.FIT); hud = "Pantalla: ${vm.ui.value.fitMode.label}" },
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
            // "Modo cine": la luz ambiente del video (como YouTube) se mantiene tal cual.
            AmbientGlow(textureView, enabled = prefs?.ambientMode == true && !chrome.isInPip && !Kaze.reducedMotion, playing = ui.isPlaying, intensity = prefs?.ambientIntensity ?: 0.6f)
            KazeVideoSurface(
                player = vm.player, aspect = ui.videoAspect, fitMode = ui.fitMode,
                subtitleScale = prefs?.subtitleScale ?: 1f, subtitleBackground = prefs?.subtitleBackground ?: true,
                modifier = Modifier.fillMaxSize().playerGestures(!chrome.isInPip, gestures),
                onTextureView = { textureView = it },
            )
            if (!chrome.isInPip) {
                if (ui.buffering && ui.error == null) KazeSpinner(Modifier.align(Alignment.Center).size(44.dp), color = Kaze.colors.primary)
                doubleTapFlash?.let { side ->
                    Box(Modifier.align(if (side == TapSide.LEFT) Alignment.CenterStart else Alignment.CenterEnd).padding(32.dp).size(76.dp).clip(CircleShape).background(Kaze.colors.primary.copy(alpha = 0.3f)), contentAlignment = Alignment.Center) {
                        Text(if (side == TapSide.LEFT) "−10 s" else "+10 s", color = Color.White, style = Kaze.type.titleSmall)
                    }
                }
                (seekPreview?.let { "${formatTime(it)} / ${formatTime(ui.durationMs)}" } ?: hud ?: if (ui.speedBoost) "Velocidad 2× · suelta para volver" else null)?.let { msg ->
                    Text(msg, color = Color.White, style = Kaze.type.titleSmall, modifier = Modifier.align(Alignment.TopCenter).padding(top = 52.dp).clip(RoundedCornerShape(50)).background(Color.Black.copy(alpha = 0.6f)).padding(horizontal = 14.dp, vertical = 6.dp).semantics { liveRegion = LiveRegionMode.Polite })
                }
                AnimatedVisibility(controlsVisible || !ui.isPlaying, Modifier.fillMaxSize(), enter = fadeIn(tween(160)), exit = fadeOut(tween(220))) {
                    Controls(ui, vm, chrome, immersive, onSettings = { showSettings = true }, theater = theater, onTheater = { theater = !theater })
                }
                ui.activeSkip?.let { marker ->
                    SkipButton(
                        if (marker.kind == SkipKind.INTRO) "Saltar intro" else "Saltar ending", { vm.skip(marker) },
                        Modifier.align(Alignment.BottomEnd).padding(end = 16.dp, bottom = if (immersive) 72.dp else 52.dp),
                    )
                }
                ui.nextCountdown?.let { s -> NextEpisodeCard(s, ui.request?.episode?.plus(1) ?: 0, onPlay = { vm.cancelAutoNext(); vm.next() }, onCancel = vm::cancelAutoNext, modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp)) }
                if (showStats) StatsOverlay(ui, Modifier.align(Alignment.TopStart).padding(top = 56.dp, start = 16.dp))
                ui.error?.let { err ->
                    Column(Modifier.align(Alignment.Center).padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(err, color = Color.White, style = Kaze.type.body)
                        Spacer(Modifier.height(12.dp))
                        KazeButton("Reintentar", vm::retry)
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
                Spacer(Modifier.fillMaxWidth().background(Color.Black).windowInsetsPadding(WindowInsets.statusBars))
                videoArea(Modifier.fillMaxWidth().aspectRatio(16f / 9f).heightIn(max = maxVideoHeight))
                InfoPanel(ui, vm, chrome, Modifier.weight(1f))
            }
        }
    }

    if (showSettings) PlayerSettingsSheet(ui, vm, showStats, { showStats = it }, onDismiss = { showSettings = false })
}

/**
 * Botones centrales con el diseño de KAZE: toman el color del tema (morado, rosa, celeste o beige),
 * brillan suave y al tocarlos se encogen y sueltan un destello del color del tema.
 * En Zen Studio (editorial) van planos, sin brillo, como el resto de ese tema.
 */
@Composable
private fun ThemedControl(icon: ImageVector, label: String, onClick: () -> Unit, main: Boolean, size: Dp) {
    val c = Kaze.colors
    val flat = Kaze.style.ornament == com.kaze.mobile.core.designsystem.theme.Ornament.EDITORIAL
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed && !Kaze.reducedMotion) 0.88f else 1f, spring(dampingRatio = 0.5f, stiffness = 600f), label = "press")
    val glow by animateFloatAsState(if (pressed) 1f else 0f, tween(if (pressed) 90 else 420), label = "glow")
    Box(
        Modifier.size(size + 16.dp).graphicsLayer { scaleX = scale; scaleY = scale },
        contentAlignment = Alignment.Center,
    ) {
        // Destello al tocar
        if (!flat) Box(Modifier.size(size + 16.dp * glow).clip(CircleShape).background(c.primary.copy(alpha = 0.35f * glow)))
        Box(
            Modifier.size(size)
                .then(if (main && !flat) Modifier.shadow(16.dp, CircleShape, ambientColor = c.primary, spotColor = c.accent) else Modifier)
                .clip(CircleShape)
                .background(
                    when {
                        main && flat -> SolidColor(c.primary)
                        main -> Brush.linearGradient(listOf(c.primary, c.accent))
                        else -> SolidColor(Color.Black.copy(alpha = 0.35f))
                    },
                )
                .then(if (!main) Modifier.border(1.5.dp, c.primary.copy(alpha = 0.75f), CircleShape) else Modifier)
                .clickable(interaction, ripple(color = if (main) c.onPrimary else c.primary), role = Role.Button, onClickLabel = label, onClick = onClick),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = label, tint = if (main) c.onPrimary else Color.White, modifier = Modifier.size(size * 0.56f))
        }
    }
}

/** Icono del reproductor: blanco, sin fondo, con área táctil de 44 dp (como Crunchyroll). */
@Composable
private fun PlayerIcon(icon: ImageVector, label: String, onClick: () -> Unit, iconSize: Dp = 24.dp, touch: Dp = 44.dp, enabled: Boolean = true) {
    Box(
        Modifier.size(touch).clip(CircleShape)
            .clickable(remember { MutableInteractionSource() }, ripple(bounded = false, radius = touch / 2, color = Kaze.colors.primary), enabled = enabled, role = Role.Button, onClickLabel = label, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = label, tint = Color.White.copy(alpha = if (enabled) 1f else 0.35f), modifier = Modifier.size(iconSize))
    }
}

@Composable
private fun Controls(ui: PlayerUi, vm: PlayerViewModel, chrome: PlayerChrome, immersive: Boolean, onSettings: () -> Unit, theater: Boolean, onTheater: () -> Unit) {
    var scrub by remember { mutableStateOf<Float?>(null) }
    val dur = ui.durationMs.coerceAtLeast(1)
    Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.4f))) {
        // Arriba: cerrar, (título en pantalla completa) y pocas acciones.
        Row(
            Modifier.fillMaxWidth().align(Alignment.TopStart).padding(horizontal = if (immersive) 16.dp else 4.dp, vertical = if (immersive) 10.dp else 0.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PlayerIcon(Icons.AutoMirrored.Filled.ArrowBack, "Cerrar reproductor", chrome.onBack)
            if (immersive) {
                Column(Modifier.weight(1f).padding(start = 8.dp)) {
                    Text(ui.request?.title ?: "", color = Color.White, style = Kaze.type.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text("Episodio ${ui.request?.episode ?: ""}", color = Color.White.copy(alpha = 0.7f), style = Kaze.type.bodySmall, maxLines = 1)
                }
            } else Spacer(Modifier.weight(1f))
            if (ui.hasNext) PlayerIcon(Icons.Filled.SkipNext, "Siguiente episodio", vm::next)
            if (chrome.isWide) PlayerIcon(Icons.Filled.Theaters, if (theater) "Salir de modo cine" else "Modo cine", onTheater)
            PlayerIcon(Icons.Filled.PictureInPictureAlt, "Ventana flotante", chrome.onEnterPip, iconSize = 22.dp)
            PlayerIcon(Icons.Filled.Settings, "Preferencias de reproducción", onSettings)
            PlayerIcon(if (chrome.isFullscreen) Icons.Filled.FullscreenExit else Icons.Filled.Fullscreen, if (chrome.isFullscreen) "Salir de pantalla completa" else "Pantalla completa", chrome.onToggleFullscreen, iconSize = 26.dp)
        }
        // Centro: solo -10 / reproducir / +10, sin círculos de color.
        Row(Modifier.align(Alignment.Center), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(if (immersive) 48.dp else 22.dp)) {
            ThemedControl(Icons.Filled.Replay10, "Retroceder 10 segundos", { vm.seekBy(-10_000) }, main = false, size = 46.dp)
            ThemedControl(if (ui.isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow, if (ui.isPlaying) "Pausar" else "Reproducir", vm::togglePlay, main = true, size = if (immersive) 66.dp else 58.dp)
            ThemedControl(Icons.Filled.Forward10, "Adelantar 10 segundos", { vm.seekBy(10_000) }, main = false, size = 46.dp)
        }
        // Abajo: tiempo a los lados y una barra fina.
        Column(Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(horizontal = if (immersive) 24.dp else 0.dp).padding(bottom = if (immersive) 14.dp else 0.dp)) {
            Row(Modifier.fillMaxWidth().padding(horizontal = if (immersive) 0.dp else 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(formatTime(scrub?.let { (it * dur).toLong() } ?: ui.positionMs), color = Color.White, style = Kaze.type.label)
                if (ui.speed != 1f) Text("  ·  ${ui.speed}×", color = Color.White.copy(alpha = 0.8f), style = Kaze.type.label)
                Spacer(Modifier.weight(1f))
                Text(formatTime(ui.durationMs), color = Color.White, style = Kaze.type.label)
            }
            SeekBar(ui, scrub, { scrub = it }, vm::seekTo)
        }
    }
}

/** Barra de progreso fina (3 dp) con bolita pequeña; se engrosa al arrastrar. Toca o arrastra para saltar. */
@Composable
private fun SeekBar(ui: PlayerUi, scrub: Float?, onScrub: (Float?) -> Unit, onSeek: (Long) -> Unit) {
    val primary = Kaze.colors.primary
    var widthPx by remember { mutableFloatStateOf(1f) }
    val dur = ui.durationMs.coerceAtLeast(1)
    val value = (scrub ?: (ui.positionMs.toFloat() / dur)).coerceIn(0f, 1f)
    val buffered = (ui.bufferedMs.toFloat() / dur).coerceIn(0f, 1f)
    val dragging = scrub != null
    Box(
        Modifier.fillMaxWidth().height(22.dp)
            .onSizeChanged { widthPx = it.width.toFloat().coerceAtLeast(1f) }
            .pointerInput(dur) { detectTapGestures { o -> onSeek(((o.x / widthPx).coerceIn(0f, 1f) * dur).toLong()) } }
            .pointerInput(dur) {
                detectHorizontalDragGestures(
                    onDragStart = { o -> onScrub((o.x / widthPx).coerceIn(0f, 1f)) },
                    onDragEnd = { scrub?.let { onSeek((it * dur).toLong()) }; onScrub(null) },
                    onDragCancel = { onScrub(null) },
                    onHorizontalDrag = { change, _ -> onScrub((change.position.x / widthPx).coerceIn(0f, 1f)) },
                )
            }
            .semantics {
                contentDescription = "Barra de progreso"
                stateDescription = "${formatTime(ui.positionMs)} de ${formatTime(ui.durationMs)}"
                progressBarRangeInfo = ProgressBarRangeInfo(value, 0f..1f)
                setProgress { t -> onSeek((t * dur).toLong()); true }
            },
    ) {
        Canvas(Modifier.fillMaxSize()) {
            val th = (if (dragging) 5.dp else 3.dp).toPx()
            val y = size.height / 2f
            val r = CornerRadius(th / 2f)
            drawRoundRect(Color.White.copy(alpha = 0.25f), Offset(0f, y - th / 2f), Size(size.width, th), r)
            drawRoundRect(Color.White.copy(alpha = 0.45f), Offset(0f, y - th / 2f), Size(size.width * buffered, th), r)
            drawRoundRect(primary, Offset(0f, y - th / 2f), Size(size.width * value, th), r)
            drawCircle(primary, radius = (if (dragging) 8.dp else 6.dp).toPx(), center = Offset((size.width * value).coerceIn(6.dp.toPx(), size.width - 6.dp.toPx()), y))
        }
    }
}

@Composable
private fun SkipButton(text: String, onClick: () -> Unit, modifier: Modifier) {
    Text(
        text, color = Color.White, style = Kaze.type.label,
        modifier = modifier.clip(RoundedCornerShape(6.dp)).background(Color.Black.copy(alpha = 0.55f))
            .border(1.dp, Kaze.colors.primary, RoundedCornerShape(6.dp))
            .clickable(role = Role.Button, onClick = onClick).padding(horizontal = 14.dp, vertical = 8.dp),
    )
}

@Composable
private fun NextEpisodeCard(seconds: Int, episode: Int, onPlay: () -> Unit, onCancel: () -> Unit, modifier: Modifier) {
    AnimatedVisibility(true, modifier, enter = scaleIn() + fadeIn(), exit = scaleOut() + fadeOut()) {
        Column(
            Modifier.width(230.dp).clip(RoundedCornerShape(10.dp)).background(Color.Black.copy(alpha = 0.75f)).padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text("Episodio $episode en $seconds s", style = Kaze.type.titleSmall, color = Color.White, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                KazeButton("Ver ahora", onPlay, modifier = Modifier.weight(1f), minHeight = 40.dp)
                KazeButton("Cancelar", onCancel, kind = KazeButtonKind.Ghost, minHeight = 40.dp)
            }
        }
    }
}

@Composable
private fun StatsOverlay(ui: PlayerUi, modifier: Modifier) {
    val s = ui.stats
    Column(modifier.clip(RoundedCornerShape(8.dp)).background(Color.Black.copy(alpha = 0.7f)).padding(12.dp)) {
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

/** Debajo del video (vertical): ordenado como Crunchyroll. Serie, episodio, audio, acciones, próximo episodio y comentarios. */
@Composable
private fun InfoPanel(ui: PlayerUi, vm: PlayerViewModel, chrome: PlayerChrome, modifier: Modifier) {
    val c = Kaze.colors
    val r = ui.request
    val context = LocalContext.current
    var menu by remember { mutableStateOf(false) }
    val downloads by vm.downloadRepo.downloads.collectAsStateWithLifecycle()
    val dl = remember(downloads, r) { r?.let { req -> downloads.firstOrNull { it.id == "${req.animeId}:${req.episode}" }?.status } }
    Column(
        modifier.background(c.background).verticalScroll(rememberScrollState()).windowInsetsPadding(WindowInsets.navigationBars).padding(horizontal = 16.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            r?.title ?: "", style = Kaze.type.titleSmall, color = c.primary, maxLines = 1, overflow = TextOverflow.Ellipsis,
            modifier = Modifier.clickable(role = Role.Button, onClickLabel = "Ver la página del anime", onClick = chrome.onOpenAnime),
        )
        Text("Episodio ${r?.episode ?: ""}", style = Kaze.type.headline, color = c.text)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                listOfNotNull(r?.totalEpisodes?.let { "de $it" }, if (ui.currentAudioOption == "latino") "Doblaje latino" else "Japonés con subtítulos").joinToString(" · "),
                style = Kaze.type.bodySmall, color = c.textMuted, modifier = Modifier.weight(1f),
            )
            KazeIconButton(
                when (dl) { DownloadStatus.COMPLETED -> Icons.Filled.DownloadDone; DownloadStatus.DOWNLOADING -> Icons.Filled.Downloading; else -> Icons.Filled.Download },
                when (dl) { DownloadStatus.COMPLETED -> "Episodio descargado"; DownloadStatus.DOWNLOADING -> "Descargando…"; else -> "Descargar episodio" },
                { if (dl != DownloadStatus.COMPLETED && dl != DownloadStatus.DOWNLOADING) vm.downloadCurrentEpisode() },
                tint = if (dl == DownloadStatus.COMPLETED) c.primary else c.text,
            )
            Box {
                KazeIconButton(Icons.Filled.MoreVert, "Más opciones", { menu = true })
                DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                    DropdownMenuItem(text = { Text("Ver serie") }, onClick = { menu = false; chrome.onOpenAnime() })
                    DropdownMenuItem(text = { Text("Compartir episodio") }, onClick = {
                        menu = false
                        r?.let {
                            val send = Intent(Intent.ACTION_SEND).setType("text/plain")
                                .putExtra(Intent.EXTRA_TEXT, "Estoy viendo ${it.title}, episodio ${it.episode}, en KAZE\nhttps://www.orunei.sbs/anime/${it.animeId}")
                            context.startActivity(Intent.createChooser(send, "Compartir episodio").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                        }
                    })
                }
            }
        }
        // Audio: dos opciones en una sola pastilla (Japonés / Latino), sin banderas gigantes.
        if (ui.isDubbedAvailable || ui.source?.isDubbedAvailable == true) {
            Segmented(
                listOf("sub" to "Japonés", "latino" to "Español latino"), ui.currentAudioOption, vm::switchAudio,
            )
        }
        ui.resumedFromMs?.let { Text("Retomado desde ${formatTime(it)}", style = Kaze.type.bodySmall, color = c.textMuted) }
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
        if (r != null && ui.hasNext) {
            Spacer(Modifier.height(8.dp))
            Text("Próximo episodio", style = Kaze.type.title, color = c.text)
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).clickable(role = Role.Button, onClickLabel = "Ver el episodio ${r.episode + 1}", onClick = vm::next).padding(vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.width(150.dp).aspectRatio(16f / 9f).clip(RoundedCornerShape(6.dp)).background(c.surfaceHigh)) {
                    AnimeImage(r.bannerUrl ?: r.coverUrl, null, Modifier.fillMaxSize())
                    Box(Modifier.align(Alignment.Center).size(34.dp).clip(CircleShape).background(Color.Black.copy(alpha = 0.45f)), contentAlignment = Alignment.Center) {
                        Icon(Icons.Filled.PlayArrow, null, tint = Color.White, modifier = Modifier.size(20.dp))
                    }
                }
                Spacer(Modifier.width(12.dp))
                Text("${r.episode + 1}. Episodio ${r.episode + 1}", style = Kaze.type.body, color = c.text, modifier = Modifier.weight(1f))
            }
        }
        Text(
            "Todos los episodios", style = Kaze.type.titleSmall, color = c.primary,
            modifier = Modifier.align(Alignment.CenterHorizontally).clip(RoundedCornerShape(8.dp))
                .clickable(role = Role.Button, onClick = chrome.onOpenAnime).padding(horizontal = 16.dp, vertical = 12.dp),
        )
        Box(Modifier.fillMaxWidth().height(1.dp).background(c.text.copy(alpha = 0.08f)))
        r?.let { EpisodeCommentsSection(it) }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun Segmented(options: List<Pair<String, String>>, selected: String, onSelect: (String) -> Unit) {
    val c = Kaze.colors
    Row(Modifier.clip(RoundedCornerShape(50)).background(c.surfaceHigh).padding(3.dp)) {
        options.forEach { (key, label) ->
            val sel = key == selected
            Text(
                label, style = Kaze.type.label, color = if (sel) c.onPrimary else c.text,
                modifier = Modifier.clip(RoundedCornerShape(50)).background(if (sel) c.primary else Color.Transparent)
                    .clickable(role = Role.RadioButton, onClickLabel = label) { onSelect(key) }
                    .padding(horizontal = 14.dp, vertical = 7.dp),
            )
        }
    }
}

private enum class SettingsPage(val title: String) {
    MAIN("Preferencias de reproducción"), AUDIO("Audio"), SUBS("Subtítulos"), QUALITY("Calidad"),
    SPEED("Velocidad de reproducción"), FIT("Ajuste de pantalla"), SUB_STYLE("Estilo de subtítulos"), AMBIENT("Modo cine"),
}

/** Ajustes como lista (igual que Crunchyroll): cada fila muestra su valor y abre su propia página. */
@Composable
private fun PlayerSettingsSheet(ui: PlayerUi, vm: PlayerViewModel, showStats: Boolean, onStats: (Boolean) -> Unit, onDismiss: () -> Unit) {
    val c = Kaze.colors
    val prefs by vm.prefs.collectAsStateWithLifecycle()
    var page by remember { mutableStateOf(SettingsPage.MAIN) }
    val dubbed = ui.isDubbedAvailable || ui.source?.isDubbedAvailable == true
    val audioLabel = if (ui.currentAudioOption == "latino") "Español latino" else "Japonés"
    val subsLabel = if (ui.subtitlesOff || ui.textTracks.none { it.selected }) "Desactivados" else ui.textTracks.first { it.selected }.label
    val qualityLabel = if (ui.autoQuality) "Automática" else ui.qualities.firstOrNull { it.selected }?.label ?: "Automática"
    ModalBottomSheet(onDismiss, containerColor = c.surface, shape = Kaze.style.sheetShape) {
        Column(Modifier.verticalScroll(rememberScrollState()).padding(bottom = 28.dp)) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                if (page != SettingsPage.MAIN) KazeIconButton(Icons.AutoMirrored.Filled.KeyboardArrowLeft, "Volver", { page = SettingsPage.MAIN })
                else Spacer(Modifier.width(12.dp))
                Text(page.title, style = Kaze.type.title, color = c.text)
            }
            when (page) {
                SettingsPage.MAIN -> {
                    SwitchRow("Reproducción automática", prefs?.autoNext ?: true, vm::setAutoNext)
                    NavRow("Audio", audioLabel) { page = SettingsPage.AUDIO }
                    NavRow("Subtítulos", subsLabel) { page = SettingsPage.SUBS }
                    NavRow("Calidad", qualityLabel) { page = SettingsPage.QUALITY }
                    NavRow("Velocidad de reproducción", "${ui.speed}×") { page = SettingsPage.SPEED }
                    NavRow("Ajuste de pantalla", ui.fitMode.label) { page = SettingsPage.FIT }
                    NavRow("Estilo de subtítulos", "${((prefs?.subtitleScale ?: 1f) * 100).toInt()}%") { page = SettingsPage.SUB_STYLE }
                    NavRow("Modo cine", if (prefs?.ambientMode == true) "Activado" else "Desactivado") { page = SettingsPage.AMBIENT }
                    SwitchRow("Estadísticas técnicas", showStats, onStats)
                }
                SettingsPage.AUDIO -> {
                    RadioRow("Japonés (subtitulado)", ui.currentAudioOption == "sub") { vm.switchAudio("sub"); page = SettingsPage.MAIN }
                    if (dubbed) RadioRow("Español latino (doblado)", ui.currentAudioOption == "latino") { vm.switchAudio("latino"); page = SettingsPage.MAIN }
                    if (ui.audioTracks.size > 1) {
                        SubHeader("Pistas de este video")
                        ui.audioTracks.forEach { a -> RadioRow(a.label, a.selected) { vm.selectAudio(a) } }
                    }
                }
                SettingsPage.SUBS -> {
                    RadioRow("Desactivados", ui.subtitlesOff || ui.textTracks.none { it.selected }) { vm.selectText(null); page = SettingsPage.MAIN }
                    ui.textTracks.forEach { t -> RadioRow(t.label, !ui.subtitlesOff && t.selected) { vm.selectText(t); page = SettingsPage.MAIN } }
                    if (ui.textTracks.isEmpty()) SubHeader("Este video trae los subtítulos incrustados.")
                }
                SettingsPage.QUALITY -> {
                    RadioRow("Automática" + (if (ui.autoQuality) " · ${ui.stats.resolution}" else ""), ui.autoQuality) { vm.selectQuality(null); page = SettingsPage.MAIN }
                    ui.qualities.forEach { q -> RadioRow(q.label, !ui.autoQuality && q.selected) { vm.selectQuality(q); page = SettingsPage.MAIN } }
                }
                SettingsPage.SPEED -> listOf(0.5f, 0.75f, 1f, 1.25f, 1.5f, 1.75f, 2f).forEach { s ->
                    RadioRow(if (s == 1f) "Normal" else "${s}×", ui.speed == s) { vm.setSpeed(s); page = SettingsPage.MAIN }
                }
                SettingsPage.FIT -> FitMode.entries.forEach { f -> RadioRow(f.label, ui.fitMode == f) { vm.setFitMode(f); page = SettingsPage.MAIN } }
                SettingsPage.SUB_STYLE -> {
                    var scale by remember(prefs?.subtitleScale) { mutableFloatStateOf(prefs?.subtitleScale ?: 1f) }
                    SubHeader("Tamaño: ${(scale * 100).toInt()}%")
                    Slider(scale, { scale = it }, valueRange = 0.6f..2f, onValueChangeFinished = { vm.setSubtitleScale(scale) }, colors = SliderDefaults.colors(thumbColor = c.primary, activeTrackColor = c.primary), modifier = Modifier.padding(horizontal = 20.dp))
                    SwitchRow("Fondo oscuro detrás del texto", prefs?.subtitleBackground ?: true, vm::setSubtitleBackground)
                }
                SettingsPage.AMBIENT -> {
                    SwitchRow("Luz ambiente alrededor del video", prefs?.ambientMode == true, vm::setAmbient)
                    if (prefs?.ambientMode == true) {
                        var amb by remember(prefs?.ambientIntensity) { mutableFloatStateOf(prefs?.ambientIntensity ?: 0.6f) }
                        SubHeader("Intensidad: ${(amb * 100).toInt()}%")
                        Slider(amb, { amb = it }, valueRange = 0f..1f, onValueChangeFinished = { vm.setAmbientIntensity(amb) }, colors = SliderDefaults.colors(thumbColor = c.primary, activeTrackColor = c.primary), modifier = Modifier.padding(horizontal = 20.dp).semantics { contentDescription = "Intensidad de la luz ambiente" })
                    }
                    SubHeader("Se pausa sola con el ahorro de batería y si reduces las animaciones.")
                }
            }
        }
    }
}

@Composable
private fun NavRow(label: String, value: String, onClick: () -> Unit) {
    val c = Kaze.colors
    Row(
        Modifier.fillMaxWidth().clickable(role = Role.Button, onClick = onClick).padding(horizontal = 20.dp, vertical = 15.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, style = Kaze.type.body, color = c.text, modifier = Modifier.weight(1f))
        Text(value, style = Kaze.type.bodySmall, color = c.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(start = 12.dp).width(130.dp), textAlign = androidx.compose.ui.text.style.TextAlign.End)
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = c.textMuted)
    }
}

@Composable
private fun SwitchRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    val c = Kaze.colors
    Row(
        Modifier.fillMaxWidth().clickable(role = Role.Switch) { onChange(!checked) }.padding(horizontal = 20.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, style = Kaze.type.body, color = c.text, modifier = Modifier.weight(1f))
        Switch(checked, null, colors = SwitchDefaults.colors(checkedThumbColor = c.onPrimary, checkedTrackColor = c.primary))
    }
}

@Composable
private fun RadioRow(label: String, selected: Boolean, onClick: () -> Unit) {
    val c = Kaze.colors
    Row(
        Modifier.fillMaxWidth().clickable(role = Role.RadioButton, onClick = onClick).padding(horizontal = 20.dp, vertical = 15.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, style = Kaze.type.body, color = if (selected) c.primary else c.text, modifier = Modifier.weight(1f))
        if (selected) Icon(Icons.Filled.Check, "Seleccionado", tint = c.primary)
    }
}

@Composable
private fun SubHeader(text: String) {
    Text(text, style = Kaze.type.bodySmall, color = Kaze.colors.textMuted, modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp))
}
