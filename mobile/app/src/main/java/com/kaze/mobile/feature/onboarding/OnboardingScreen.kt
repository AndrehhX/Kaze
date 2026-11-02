package com.kaze.mobile.feature.onboarding

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.kaze.mobile.core.designsystem.components.KazeButton
import com.kaze.mobile.core.designsystem.components.KazeButtonKind
import com.kaze.mobile.core.designsystem.components.KazeChip
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.core.designsystem.theme.KazeThemeId
import com.kaze.mobile.domain.model.AniListCatalog
import com.kaze.mobile.feature.settings.SettingsViewModel
import com.kaze.mobile.feature.settings.ThemePreviewCard

@Composable
fun OnboardingScreen(onDone: () -> Unit, vm: SettingsViewModel = hiltViewModel()) {
    val prefs by vm.state.collectAsStateWithLifecycle()
    var step by rememberSaveable { mutableIntStateOf(0) }
    var genres by rememberSaveable { mutableStateOf(setOf<String>()) }
    val c = Kaze.colors
    val reduced = Kaze.reducedMotion
    Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).padding(24.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
            repeat(3) { i ->
                Box(Modifier.padding(4.dp).height(4.dp).width(if (i == step) 28.dp else 12.dp).clip(CircleShape).background(if (i <= step) c.primary else c.text.copy(alpha = 0.2f)))
            }
        }
        AnimatedContent(
            step, Modifier.weight(1f),
            transitionSpec = {
                if (reduced) fadeIn(tween(0)) togetherWith fadeOut(tween(0))
                else (slideInHorizontally { it / 3 } + fadeIn()) togetherWith (slideOutHorizontally { -it / 3 } + fadeOut())
            },
            label = "onboarding",
        ) { s ->
            when (s) {
                0 -> Welcome()
                1 -> Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(top = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Elige tu estilo visual", style = Kaze.type.headline, color = c.text, modifier = Modifier.semantics { heading() })
                    Text("Cada tema transforma formas, tipografía y movimiento. Puedes cambiarlo en cualquier momento en Ajustes.", style = Kaze.type.body, color = c.textMuted)
                    KazeThemeId.entries.chunked(2).forEach { row ->
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            row.forEach { id -> ThemePreviewCard(id, prefs?.theme == id, Modifier.weight(1f)) { vm.setTheme(id) } }
                        }
                    }
                }
                else -> Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(top = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("¿Qué te apasiona ver?", style = Kaze.type.headline, color = c.text, modifier = Modifier.semantics { heading() })
                    Text("Elige tus géneros favoritos para personalizar tus recomendaciones. Se guardan de forma privada en tu dispositivo.", style = Kaze.type.body, color = c.textMuted)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        AniListCatalog.genres.filterNot { it == "Ecchi" }.forEach { g ->
                            KazeChip(g, selected = g in genres, onClick = { genres = if (g in genres) genres - g else genres + g })
                        }
                    }
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            if (step > 0) KazeButton("Atrás", { step-- }, kind = KazeButtonKind.Secondary)
            else KazeButton("Omitir", { vm.completeOnboarding(emptySet()); onDone() }, kind = KazeButtonKind.Ghost)
            KazeButton(
                if (step < 2) "Continuar" else "Entrar a KAZE",
                { if (step < 2) step++ else { vm.completeOnboarding(genres); onDone() } },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun Welcome() {
    val c = Kaze.colors
    val reveal = remember { Animatable(0f) }
    val reduced = Kaze.reducedMotion
    LaunchedEffect(Unit) { if (reduced) reveal.snapTo(1f) else reveal.animateTo(1f, tween(1200)) }
    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            "風", fontSize = 120.sp, color = c.primary,
            modifier = Modifier.graphicsLayer { alpha = reveal.value; scaleX = 0.8f + 0.2f * reveal.value; scaleY = 0.8f + 0.2f * reveal.value },
        )
        Text("KAZE", style = Kaze.type.display, color = c.text, modifier = Modifier.graphicsLayer { alpha = reveal.value; translationY = (1 - reveal.value) * 40f })
        Spacer(Modifier.height(8.dp))
        Text("Tu universo de anime. En cualquier lugar.", style = Kaze.type.title, color = c.textMuted, textAlign = TextAlign.Center)
        Spacer(Modifier.height(24.dp))
        Text(
            "Explora todo el catálogo de anime, mantén tu biblioteca personal sin conexión y sincroniza tu progreso en todos tus dispositivos.",
            style = Kaze.type.body, color = c.textMuted, textAlign = TextAlign.Center,
        )
    }
}
