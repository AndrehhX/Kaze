package com.kaze.mobile.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.kaze.mobile.core.designsystem.components.KazeCard
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.core.designsystem.theme.Ornament
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

/**
 * Signature interaction #7 — completion celebration. A single Canvas burst of themed
 * particles (petals for Sakura, sparks for Neon/Cyber, ink dots for Zen) over ~1.8s.
 * Reduced motion shows only the message card.
 */
@Composable
fun CompletionCelebration(title: String, onFinished: () -> Unit) {
    val c = Kaze.colors
    val ornament = Kaze.style.ornament
    val reduced = Kaze.reducedMotion
    val t = remember { Animatable(0f) }
    val particles = remember {
        val r = Random(title.hashCode())
        List(56) { Triple(r.nextFloat() * 360f, 0.45f + r.nextFloat() * 0.55f, r.nextInt(3)) }
    }
    LaunchedEffect(Unit) {
        if (!reduced) t.animateTo(1f, tween(1800, easing = FastOutSlowInEasing)) else kotlinx.coroutines.delay(1600)
        onFinished()
    }
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        if (!reduced) Canvas(Modifier.fillMaxSize()) {
            val p = t.value
            val origin = Offset(size.width / 2, size.height * 0.45f)
            val colors = listOf(c.primary, c.accent, c.secondary)
            particles.forEach { (angle, speed, colorIdx) ->
                val rad = Math.toRadians(angle.toDouble())
                val dist = size.minDimension * 0.62f * speed * p
                val gravity = size.height * 0.25f * p * p
                val pos = Offset(origin.x + (cos(rad) * dist).toFloat(), origin.y + (sin(rad) * dist).toFloat() + gravity)
                val alpha = (1f - p).coerceIn(0f, 1f)
                val color = colors[colorIdx].copy(alpha = alpha)
                when (ornament) {
                    Ornament.PETAL -> rotate(angle + p * 360f, pos) { drawOval(color, pos - Offset(7f, 4f), Size(14f, 8f)) }
                    Ornament.EDITORIAL -> drawCircle(color, 5f * (1f - p * 0.5f), pos)
                    else -> drawLine(color, pos, pos - Offset((cos(rad) * 18).toFloat(), (sin(rad) * 18).toFloat()), strokeWidth = 4f)
                }
            }
        }
        KazeCard(
            Modifier.padding(32.dp).graphicsLayer {
                val s = if (reduced) 1f else 0.85f + 0.15f * (t.value * 4f).coerceAtMost(1f)
                scaleX = s; scaleY = s
            }.semantics { liveRegion = LiveRegionMode.Assertive },
            highlighted = true,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("★ Completed", style = Kaze.type.overline, color = c.accentText)
                Text(title, style = Kaze.type.headline, color = c.text, textAlign = TextAlign.Center)
                Text("Added to your completed list", style = Kaze.type.bodySmall, color = c.textMuted)
            }
        }
    }
}
