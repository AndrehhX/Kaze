package com.kaze.mobile.core.designsystem.theme

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.translate
import kotlin.math.PI
import kotlin.math.sin
import kotlin.random.Random

/**
 * The atmospheric layer behind every screen. Each theme draws its own world with a
 * single Canvas; animation is a single infinite transition (one frame clock), and
 * it is frozen entirely when reduced motion or ambient effects are off.
 */
@Composable
fun KazeBackdrop(modifier: Modifier = Modifier) {
    val style = Kaze.style
    Crossfade(targetState = style.ornament, animationSpec = tween(if (Kaze.reducedMotion) 0 else 600), label = "backdrop", modifier = modifier) { ornament ->
        Box(Modifier.fillMaxSize().background(Kaze.colors.background)) {
            when (ornament) {
                Ornament.GLOW -> NeonBackdrop()
                Ornament.PETAL -> SakuraBackdrop()
                Ornament.CIRCUIT -> CyberBackdrop()
                Ornament.EDITORIAL -> ZenBackdrop()
            }
        }
    }
}

/** Animation phase read only inside draw lambdas, so frames redraw without recomposing. */
@Composable
private fun phase(periodMs: Int): State<Float> {
    if (!LocalAmbientEffects.current) return remember { mutableFloatStateOf(0f) }
    val t = rememberInfiniteTransition(label = "ambient")
    return t.animateFloat(0f, 1f, infiniteRepeatable(tween(periodMs, easing = LinearEasing), RepeatMode.Restart), label = "phase")
}

@Composable
private fun NeonBackdrop() {
    val c = Kaze.colors
    val phase = phase(14_000)
    Canvas(Modifier.fillMaxSize()) {
        val p = phase.value
        val pulse = 0.85f + 0.15f * sin(p * 2 * PI).toFloat()
        drawCircle(
            Brush.radialGradient(listOf(c.primary.copy(alpha = 0.28f * pulse), Color.Transparent), center = Offset(size.width * 0.1f, size.height * 0.08f), radius = size.width * 0.9f),
            radius = size.width * 0.9f, center = Offset(size.width * 0.1f, size.height * 0.08f),
        )
        drawCircle(
            Brush.radialGradient(listOf(c.accent.copy(alpha = 0.16f), Color.Transparent), center = Offset(size.width * 1.0f, size.height * 0.55f), radius = size.width * 0.8f),
            radius = size.width * 0.8f, center = Offset(size.width, size.height * 0.55f),
        )
        neonGrid(c.secondary.copy(alpha = 0.10f), p)
    }
}

private fun DrawScope.neonGrid(color: Color, p: Float) {
    // Perspective floor at the bottom of the screen; horizontal lines scroll toward the viewer.
    val horizon = size.height * 0.78f
    val vanishing = Offset(size.width / 2f, horizon)
    for (i in -8..8) {
        val x = size.width / 2f + i * size.width / 6f
        drawLine(color, vanishing, Offset(x * 1.0f + (x - size.width / 2f) * 1.6f, size.height), strokeWidth = 1f)
    }
    for (i in 0 until 7) {
        val f = ((i + p) / 7f)
        val y = horizon + (size.height - horizon) * f * f
        drawLine(color.copy(alpha = color.alpha * f), Offset(0f, y), Offset(size.width, y), strokeWidth = 1f)
    }
}

private class Petal(val x: Float, val speed: Float, val size: Float, val sway: Float, val spin: Float, val offset: Float)

@Composable
private fun SakuraBackdrop() {
    val c = Kaze.colors
    val petals = remember { val r = Random(7); List(14) { Petal(r.nextFloat(), 0.6f + r.nextFloat() * 0.8f, 7f + r.nextFloat() * 9f, 20f + r.nextFloat() * 40f, r.nextFloat() * 360f, r.nextFloat()) } }
    val phase = phase(26_000)
    val animate = LocalAmbientEffects.current
    Canvas(Modifier.fillMaxSize()) {
        val p = phase.value
        drawRect(Brush.verticalGradient(listOf(c.surfaceHigh, c.background, c.background)))
        drawCircle(c.secondary.copy(alpha = 0.10f), radius = size.width * 0.55f, center = Offset(size.width * 0.95f, size.height * 0.02f))
        drawCircle(c.accent.copy(alpha = 0.18f), radius = size.width * 0.4f, center = Offset(0f, size.height * 0.4f))
        if (!animate) return@Canvas
        petals.forEach { petal ->
            val prog = (p * petal.speed + petal.offset) % 1f
            val y = -40f + (size.height + 80f) * prog
            val x = size.width * petal.x + sin((prog * 4 * PI) + petal.offset * 6).toFloat() * petal.sway
            translate(x, y) {
                rotate(petal.spin + prog * 540f, pivot = Offset.Zero) {
                    drawPath(petalPath(petal.size), c.primary.copy(alpha = 0.32f))
                }
            }
        }
    }
}

private fun petalPath(s: Float) = Path().apply {
    moveTo(0f, -s)
    cubicTo(s * 0.9f, -s * 0.6f, s * 0.7f, s * 0.6f, 0f, s)
    cubicTo(-s * 0.7f, s * 0.6f, -s * 0.9f, -s * 0.6f, 0f, -s)
    close()
}

@Composable
private fun CyberBackdrop() {
    val c = Kaze.colors
    val phase = phase(7_000)
    Canvas(Modifier.fillMaxSize()) {
        val p = phase.value
        drawRect(Brush.verticalGradient(listOf(c.background, c.surface.copy(alpha = 0.6f), c.background)))
        // Dot matrix
        val step = 28f
        var y = 0f
        while (y < size.height) {
            var x = (y / step).toInt() % 2 * step / 2
            while (x < size.width) {
                drawCircle(c.primary.copy(alpha = 0.07f), 1.2f, Offset(x, y))
                x += step
            }
            y += step
        }
        // Sweeping scanline
        val sy = size.height * p
        drawRect(
            Brush.verticalGradient(listOf(Color.Transparent, c.primary.copy(alpha = 0.10f), Color.Transparent), startY = sy - 60f, endY = sy + 60f),
            topLeft = Offset(0f, sy - 60f), size = Size(size.width, 120f),
        )
        // HUD corner brackets
        val b = 26f
        val stroke = Stroke(2f)
        listOf(Offset(16f, 16f) to 1f, Offset(size.width - 16f, size.height - 16f) to -1f).forEach { (o, d) ->
            drawPath(Path().apply { moveTo(o.x, o.y + b * d); lineTo(o.x, o.y); lineTo(o.x + b * d, o.y) }, c.accent.copy(alpha = 0.35f), style = stroke)
        }
    }
}

@Composable
private fun ZenBackdrop() {
    val c = Kaze.colors
    Canvas(Modifier.fillMaxSize()) {
        // Ruled editorial lines
        var y = 0f
        while (y < size.height) {
            drawLine(c.secondary.copy(alpha = 0.035f), Offset(0f, y), Offset(size.width, y), 1f)
            y += 44f
        }
        // An open ensō brushed in the corner
        val r = size.width * 0.38f
        drawArc(
            color = c.primary.copy(alpha = 0.10f),
            startAngle = 110f, sweepAngle = 300f, useCenter = false,
            topLeft = Offset(size.width - r * 1.3f, -r * 0.5f), size = Size(r * 2, r * 2),
            style = Stroke(width = 14f),
        )
        drawLine(c.secondary.copy(alpha = 0.25f), Offset(24f, size.height - 1f), Offset(size.width * 0.3f, size.height - 1f), 2f)
    }
}
