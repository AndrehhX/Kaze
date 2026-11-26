package com.kaze.mobile.core.designsystem.components

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.kaze.mobile.core.designsystem.theme.Kaze

/**
 * Kaze-chan: el espíritu del viento (風) de KAZE para las pantallas vacías.
 * Se dibuja con los colores del tema (morado, rosa, celeste o beige) y flota suavemente.
 */
@Composable
fun KazeMascot(modifier: Modifier = Modifier, size: Dp = 168.dp) {
    val c = Kaze.colors
    val reduced = Kaze.reducedMotion
    val t = rememberInfiniteTransition(label = "mascot")
    val bob by t.animateFloat(0f, 1f, infiniteRepeatable(tween(2200, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "bob")
    val swirl by t.animateFloat(0f, 360f, infiniteRepeatable(tween(9000)), label = "swirl")
    val body = c.primary
    val bodyLight = c.accent
    val ink = Color(0xFF241A2E)
    Canvas(modifier.size(size).semantics { contentDescription = "Kaze-chan, la mascota de KAZE" }) {
        val w = this.size.width
        val h = this.size.height
        val float = if (reduced) 0f else (bob - 0.5f) * h * 0.05f
        val cx = w / 2f
        val cy = h * 0.5f + float
        val r = w * 0.27f

        // Sombra en el suelo
        drawOval(c.text.copy(alpha = 0.08f), topLeft = Offset(cx - r * 0.9f, h * 0.86f), size = Size(r * 1.8f, h * 0.06f))

        // Ráfagas de viento girando alrededor
        rotate(if (reduced) 20f else swirl, Offset(cx, cy)) {
            listOf(0f, 120f, 240f).forEachIndexed { i, a ->
                rotate(a, Offset(cx, cy)) {
                    val p = Path().apply {
                        moveTo(cx - r * 1.55f, cy - r * 0.15f)
                        cubicTo(cx - r * 1.4f, cy - r * 1.05f, cx - r * 0.3f, cy - r * 1.6f, cx + r * 0.55f, cy - r * 1.32f)
                    }
                    drawPath(p, bodyLight.copy(alpha = 0.55f - i * 0.12f), style = Stroke(width = w * 0.022f, cap = StrokeCap.Round))
                }
            }
        }

        // Mechón de viento en la cabeza (como una hoja)
        val tuft = Path().apply {
            moveTo(cx - r * 0.1f, cy - r * 0.92f)
            cubicTo(cx - r * 0.2f, cy - r * 1.55f, cx + r * 0.55f, cy - r * 1.6f, cx + r * 0.62f, cy - r * 1.18f)
            cubicTo(cx + r * 0.3f, cy - r * 1.32f, cx + r * 0.12f, cy - r * 1.1f, cx + r * 0.1f, cy - r * 0.9f)
            close()
        }
        drawPath(tuft, Brush.linearGradient(listOf(bodyLight, body), Offset(cx, cy - r * 1.6f), Offset(cx, cy - r * 0.9f)))

        // Cuerpo: gota redonda con brillo
        drawCircle(Brush.radialGradient(listOf(bodyLight, body), center = Offset(cx - r * 0.35f, cy - r * 0.4f), radius = r * 1.6f), r, Offset(cx, cy))
        drawCircle(Color.White.copy(alpha = 0.35f), r * 0.2f, Offset(cx - r * 0.45f, cy - r * 0.5f))

        // Cara
        val eyeY = cy - r * 0.05f
        listOf(-1f, 1f).forEach { side ->
            val ex = cx + side * r * 0.36f
            drawOval(ink, topLeft = Offset(ex - r * 0.11f, eyeY - r * 0.17f), size = Size(r * 0.22f, r * 0.3f))
            drawCircle(Color.White, r * 0.05f, Offset(ex - r * 0.03f, eyeY - r * 0.08f))
            drawOval(Color(0xFFFF8FB1).copy(alpha = 0.6f), topLeft = Offset(ex + side * r * 0.1f - r * 0.13f, eyeY + r * 0.2f), size = Size(r * 0.26f, r * 0.13f))
        }
        val mouth = Path().apply {
            moveTo(cx - r * 0.12f, cy + r * 0.24f)
            quadraticBezierTo(cx, cy + r * 0.38f, cx + r * 0.12f, cy + r * 0.24f)
        }
        drawPath(mouth, ink, style = Stroke(width = w * 0.016f, cap = StrokeCap.Round))

        // Destellos
        listOf(Offset(cx + r * 1.25f, cy - r * 0.9f) to 0.07f, Offset(cx - r * 1.3f, cy + r * 0.7f) to 0.05f).forEach { (o, s) ->
            val k = w * s
            val star = Path().apply {
                moveTo(o.x, o.y - k); lineTo(o.x + k * 0.25f, o.y - k * 0.25f); lineTo(o.x + k, o.y); lineTo(o.x + k * 0.25f, o.y + k * 0.25f)
                lineTo(o.x, o.y + k); lineTo(o.x - k * 0.25f, o.y + k * 0.25f); lineTo(o.x - k, o.y); lineTo(o.x - k * 0.25f, o.y - k * 0.25f); close()
            }
            drawPath(star, bodyLight)
        }
    }
}

/** Estado vacío con Kaze-chan, un título, un texto y (opcional) un botón. */
@Composable
fun MascotEmptyState(title: String, message: String, modifier: Modifier = Modifier, action: String? = null, onAction: (() -> Unit)? = null) {
    val c = Kaze.colors
    Column(
        modifier.fillMaxWidth().padding(horizontal = 32.dp, vertical = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        KazeMascot()
        Text(title, style = Kaze.type.title, color = c.text, textAlign = TextAlign.Center)
        Text(message, style = Kaze.type.body, color = c.textMuted, textAlign = TextAlign.Center)
        if (action != null && onAction != null) KazeButton(action, onAction, Modifier.padding(top = 8.dp).fillMaxWidth())
    }
}
