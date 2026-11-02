@file:androidx.annotation.OptIn(markerClass = [androidx.media3.common.util.UnstableApi::class])

package com.kaze.mobile.feature.player

import android.graphics.Bitmap
import android.os.PowerManager
import android.view.TextureView
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.calculateZoom
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.Player
import androidx.media3.common.text.CueGroup
import androidx.media3.ui.CaptionStyleCompat
import androidx.media3.ui.SubtitleView
import kotlinx.coroutines.delay
import kotlin.math.abs

/**
 * Video rendered into a TextureView (so ambient mode can sample frames) with a Media3
 * SubtitleView overlay. Shared by the episode player and watch-party rooms.
 */
@Composable
fun KazeVideoSurface(
    player: Player,
    aspect: Float,
    fitMode: FitMode,
    subtitleScale: Float,
    subtitleBackground: Boolean,
    modifier: Modifier = Modifier,
    onTextureView: (TextureView?) -> Unit = {},
) {
    BoxWithConstraints(modifier, contentAlignment = Alignment.Center) {
        val boxAspect = maxWidth / maxHeight
        val (w, h) = when (fitMode) {
            FitMode.FIT -> if (aspect > boxAspect) maxWidth to maxWidth / aspect else maxHeight * aspect to maxHeight
            FitMode.FILL -> if (aspect > boxAspect) maxHeight * aspect to maxHeight else maxWidth to maxWidth / aspect
            FitMode.ZOOM -> (if (aspect > boxAspect) maxHeight * aspect to maxHeight else maxWidth to maxWidth / aspect).let { (a, b) -> a * 1.18f to b * 1.18f }
        }
        AndroidView(
            factory = { ctx -> TextureView(ctx).also { tv -> player.setVideoTextureView(tv); onTextureView(tv) } },
            onRelease = { tv -> player.clearVideoTextureView(tv); onTextureView(null) },
            modifier = Modifier.size(w, h),
        )
        val subtitleView = remember { mutableStateOf<SubtitleView?>(null) }
        AndroidView(
            factory = { ctx -> SubtitleView(ctx).also { subtitleView.value = it } },
            update = { v ->
                v.setStyle(
                    CaptionStyleCompat(
                        android.graphics.Color.WHITE,
                        if (subtitleBackground) android.graphics.Color.argb(170, 0, 0, 0) else android.graphics.Color.TRANSPARENT,
                        android.graphics.Color.TRANSPARENT,
                        if (subtitleBackground) CaptionStyleCompat.EDGE_TYPE_NONE else CaptionStyleCompat.EDGE_TYPE_OUTLINE,
                        android.graphics.Color.BLACK,
                        null,
                    )
                )
                v.setFractionalTextSize(SubtitleView.DEFAULT_TEXT_SIZE_FRACTION * subtitleScale)
                v.setBottomPaddingFraction(0.06f)
            },
            modifier = Modifier.size(minOf(w, maxWidth), minOf(h, maxHeight)),
        )
        DisposableEffect(player) {
            val l = object : Player.Listener {
                override fun onCues(cueGroup: CueGroup) { subtitleView.value?.setCues(cueGroup.cues) }
            }
            player.addListener(l)
            onDispose { player.removeListener(l) }
        }
    }
}

/**
 * Ambient lighting: samples a 16×9 thumbnail of the current frame twice a second (only while
 * playing, visible and not in battery saver) and lets the dominant left/right colours bleed
 * into the surroundings. The sample bitmap is reused — no per-frame allocation.
 */
@Composable
fun AmbientGlow(
    textureView: TextureView?,
    enabled: Boolean,
    playing: Boolean,
    intensity: Float,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val powerSave = remember { context.getSystemService(PowerManager::class.java)?.isPowerSaveMode == true }
    var left by remember { mutableStateOf(Color.Black) }
    var right by remember { mutableStateOf(Color.Black) }
    var center by remember { mutableStateOf(Color.Black) }
    val active = enabled && !powerSave && textureView != null
    LaunchedEffect(active, playing, textureView) {
        if (!active || !playing) return@LaunchedEffect
        val bmp = Bitmap.createBitmap(16, 9, Bitmap.Config.ARGB_8888)
        try {
            while (true) {
                val tv = textureView ?: break
                if (tv.isAvailable) {
                    tv.getBitmap(bmp)
                    left = average(bmp, 0, 5)
                    right = average(bmp, 11, 16)
                    center = average(bmp, 5, 11)
                }
                delay(500)
            }
        } finally { bmp.recycle() }
    }
    val l by animateColorAsState(if (active) left else Color.Black, tween(900), label = "amb-l")
    val r by animateColorAsState(if (active) right else Color.Black, tween(900), label = "amb-r")
    val m by animateColorAsState(if (active) center else Color.Black, tween(900), label = "amb-c")
    if (!active) return
    Canvas(modifier.fillMaxSize()) {
        val a = intensity.coerceIn(0f, 1f)
        drawRect(Color.Black)
        drawCircle(Brush.radialGradient(listOf(l.copy(alpha = 0.85f * a), Color.Transparent), center = Offset(0f, size.height * 0.35f), radius = size.maxDimension * 0.7f), radius = size.maxDimension * 0.7f, center = Offset(0f, size.height * 0.35f))
        drawCircle(Brush.radialGradient(listOf(r.copy(alpha = 0.85f * a), Color.Transparent), center = Offset(size.width, size.height * 0.35f), radius = size.maxDimension * 0.7f), radius = size.maxDimension * 0.7f, center = Offset(size.width, size.height * 0.35f))
        drawCircle(Brush.radialGradient(listOf(m.copy(alpha = 0.6f * a), Color.Transparent), center = Offset(size.width / 2, size.height * 0.3f), radius = size.maxDimension * 0.6f), radius = size.maxDimension * 0.6f, center = Offset(size.width / 2, size.height * 0.3f))
    }
}

private fun average(bmp: Bitmap, fromX: Int, toX: Int): Color {
    var r = 0L; var g = 0L; var b = 0L; var n = 0
    for (x in fromX until toX) for (y in 0 until bmp.height) {
        val p = bmp.getPixel(x, y)
        r += (p shr 16) and 0xFF; g += (p shr 8) and 0xFF; b += p and 0xFF; n++
    }
    if (n == 0) return Color.Black
    // Lift saturation slightly so dim scenes still glow tastefully.
    return Color((r / n).toInt(), (g / n).toInt(), (b / n).toInt()).let { c -> Color(c.red * 1.1f, c.green * 1.1f, c.blue * 1.1f).copy(alpha = 1f) }
}

enum class TapSide { LEFT, RIGHT, CENTER }

class PlayerGestureCallbacks(
    val onTap: () -> Unit,
    val onDoubleTap: (TapSide) -> Unit,
    val onSeekDrag: (fraction: Float) -> Unit,
    val onSeekEnd: () -> Unit,
    val onBrightnessDrag: (delta: Float) -> Unit,
    val onVolumeDrag: (delta: Float) -> Unit,
    val onAdjustEnd: () -> Unit,
    val onPinch: (zoom: Float) -> Unit,
    val onLongPress: (pressed: Boolean) -> Unit,
)

/**
 * One gesture arena for the whole video so taps, drags, pinches and long-presses never
 * fight each other. Gestures that start inside the system-gesture margins are ignored
 * (except taps) so they can't collide with Android's back/home swipes.
 */
fun Modifier.playerGestures(enabled: Boolean, callbacks: PlayerGestureCallbacks): Modifier = this.then(
    if (!enabled) Modifier else Modifier.pointerInput(Unit) {
        val cb = callbacks
        var lastTap = 0L
        var lastSide = TapSide.CENTER
        var streakUntil = 0L
        val edge = 32.dp.toPx()
        awaitEachGesture {
            val down = awaitFirstDown(requireUnconsumed = false)
            val start = down.uptimeMillis
            val inEdge = down.position.x < edge || down.position.x > size.width - edge || down.position.y < edge || down.position.y > size.height - edge
            val side = when {
                down.position.x < size.width * 0.38f -> TapSide.LEFT
                down.position.x > size.width * 0.62f -> TapSide.RIGHT
                else -> TapSide.CENTER
            }
            var mode = 0 // 0 none, 1 seek, 2 brightness, 3 volume, 4 pinch
            var longPressed = false
            var zoomTotal = 1f
            var last = down.position
            while (true) {
                val event = awaitPointerEvent()
                val pressed = event.changes.filter { it.pressed }
                if (pressed.isEmpty()) break
                if (pressed.size >= 2 && !longPressed) {
                    mode = 4
                    zoomTotal *= event.calculateZoom()
                    event.changes.forEach { it.consume() }
                    continue
                }
                val ch = pressed.first()
                val total = ch.position - down.position
                if (mode == 0 && !longPressed) {
                    if (total.getDistance() > viewConfiguration.touchSlop && !inEdge) {
                        mode = if (abs(total.x) > abs(total.y)) 1 else if (down.position.x < size.width / 2) 2 else 3
                    } else if (total.getDistance() <= viewConfiguration.touchSlop && ch.uptimeMillis - start > viewConfiguration.longPressTimeoutMillis && !inEdge) {
                        longPressed = true
                        cb.onLongPress(true)
                    }
                }
                val delta = ch.position - last
                last = ch.position
                when (mode) {
                    1 -> { cb.onSeekDrag(total.x / size.width); ch.consume() }
                    2 -> { cb.onBrightnessDrag(-delta.y / size.height); ch.consume() }
                    3 -> { cb.onVolumeDrag(-delta.y / size.height); ch.consume() }
                }
            }
            when {
                longPressed -> cb.onLongPress(false)
                mode == 1 -> cb.onSeekEnd()
                mode == 2 || mode == 3 -> cb.onAdjustEnd()
                mode == 4 -> cb.onPinch(zoomTotal)
                else -> {
                    val now = System.currentTimeMillis()
                    val isRepeat = side != TapSide.CENTER && ((now - lastTap < 300 && side == lastSide) || (now < streakUntil && side == lastSide))
                    if (isRepeat) {
                        if (now >= streakUntil) cb.onTap() // undo the first tap's toggle
                        cb.onDoubleTap(side)
                        streakUntil = now + 650
                        lastTap = 0
                    } else {
                        cb.onTap()
                        lastTap = now
                    }
                    lastSide = side
                }
            }
        }
    }
)

/** Remembers callbacks that read fresh state without restarting pointerInput. */
@Composable
fun rememberGestureCallbacks(
    onTap: () -> Unit,
    onDoubleTap: (TapSide) -> Unit,
    onSeekDrag: (Float) -> Unit,
    onSeekEnd: () -> Unit,
    onBrightnessDrag: (Float) -> Unit,
    onVolumeDrag: (Float) -> Unit,
    onAdjustEnd: () -> Unit,
    onPinch: (Float) -> Unit,
    onLongPress: (Boolean) -> Unit,
): PlayerGestureCallbacks {
    val tap by rememberUpdatedState(onTap)
    val dbl by rememberUpdatedState(onDoubleTap)
    val seek by rememberUpdatedState(onSeekDrag)
    val seekEnd by rememberUpdatedState(onSeekEnd)
    val bright by rememberUpdatedState(onBrightnessDrag)
    val vol by rememberUpdatedState(onVolumeDrag)
    val adjEnd by rememberUpdatedState(onAdjustEnd)
    val pinch by rememberUpdatedState(onPinch)
    val long by rememberUpdatedState(onLongPress)
    return remember {
        PlayerGestureCallbacks({ tap() }, { dbl(it) }, { seek(it) }, { seekEnd() }, { bright(it) }, { vol(it) }, { adjEnd() }, { pinch(it) }, { long(it) })
    }
}

fun formatTime(ms: Long): String {
    val total = (ms / 1000).coerceAtLeast(0)
    val h = total / 3600; val m = (total % 3600) / 60; val s = total % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}
