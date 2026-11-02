package com.kaze.mobile.core.designsystem.motion

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FiniteAnimationSpec
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.IntOffset
import androidx.navigation.NavBackStackEntry
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.core.designsystem.theme.MotionPersonality
import kotlinx.coroutines.delay

object KazeMotion {
    fun <T> spec(personality: MotionPersonality, reduced: Boolean): FiniteAnimationSpec<T> = when {
        reduced -> tween(0)
        personality == MotionPersonality.SPRING -> spring(dampingRatio = 0.72f, stiffness = Spring.StiffnessMediumLow)
        personality == MotionPersonality.SOFT -> spring(dampingRatio = 0.9f, stiffness = Spring.StiffnessLow)
        personality == MotionPersonality.DIRECTIONAL -> tween(260)
        else -> tween(320)
    }

    private fun offsetSpec(p: MotionPersonality): FiniteAnimationSpec<IntOffset> = when (p) {
        MotionPersonality.SPRING -> spring(dampingRatio = 0.86f, stiffness = Spring.StiffnessMediumLow)
        MotionPersonality.SOFT -> spring(dampingRatio = 1f, stiffness = Spring.StiffnessLow)
        MotionPersonality.DIRECTIONAL -> tween(240)
        MotionPersonality.MINIMAL -> tween(300)
    }

    /** Screen enter transition; each theme moves differently. */
    fun enter(p: MotionPersonality, reduced: Boolean): AnimatedContentTransitionScope<NavBackStackEntry>.() -> EnterTransition = {
        if (reduced) fadeIn(tween(0)) else when (p) {
            MotionPersonality.SPRING -> slideInHorizontally(offsetSpec(p)) { it / 5 } + fadeIn(tween(220)) + scaleIn(initialScale = 0.98f)
            MotionPersonality.SOFT -> fadeIn(tween(380)) + scaleIn(initialScale = 0.95f, animationSpec = spring(1f, Spring.StiffnessLow))
            MotionPersonality.DIRECTIONAL -> slideInHorizontally(offsetSpec(p)) { it } + fadeIn(tween(120))
            MotionPersonality.MINIMAL -> fadeIn(tween(320))
        }
    }

    fun exit(p: MotionPersonality, reduced: Boolean): AnimatedContentTransitionScope<NavBackStackEntry>.() -> ExitTransition = {
        if (reduced) fadeOut(tween(0)) else when (p) {
            MotionPersonality.SPRING -> fadeOut(tween(180)) + scaleOut(targetScale = 0.97f)
            MotionPersonality.SOFT -> fadeOut(tween(260))
            MotionPersonality.DIRECTIONAL -> slideOutHorizontally(offsetSpec(p)) { -it / 3 } + fadeOut(tween(200))
            MotionPersonality.MINIMAL -> fadeOut(tween(220))
        }
    }

    fun popEnter(p: MotionPersonality, reduced: Boolean): AnimatedContentTransitionScope<NavBackStackEntry>.() -> EnterTransition = {
        if (reduced) fadeIn(tween(0)) else when (p) {
            MotionPersonality.DIRECTIONAL -> slideInHorizontally(offsetSpec(p)) { -it / 3 } + fadeIn(tween(200))
            else -> fadeIn(tween(260)) + scaleIn(initialScale = 0.98f)
        }
    }

    fun popExit(p: MotionPersonality, reduced: Boolean): AnimatedContentTransitionScope<NavBackStackEntry>.() -> ExitTransition = {
        if (reduced) fadeOut(tween(0)) else when (p) {
            MotionPersonality.SPRING -> slideOutHorizontally(offsetSpec(p)) { it / 4 } + fadeOut(tween(200))
            MotionPersonality.SOFT -> fadeOut(tween(260)) + scaleOut(targetScale = 0.95f)
            MotionPersonality.DIRECTIONAL -> slideOutHorizontally(offsetSpec(p)) { it } + fadeOut(tween(120))
            MotionPersonality.MINIMAL -> fadeOut(tween(220))
        }
    }

    fun sheetEnter(): EnterTransition = slideInVertically { it / 3 } + fadeIn()
    fun sheetExit(): ExitTransition = slideOutVertically { it / 3 } + fadeOut()
}

/** Tactile press feedback: a short squash that respects reduced motion. */
fun Modifier.pressScale(interaction: MutableInteractionSource, pressed: Float = 0.96f): Modifier = composed {
    val isPressed by interaction.collectIsPressedAsState()
    val reduced = Kaze.reducedMotion
    val scale by animateFloatAsState(
        targetValue = if (isPressed && !reduced) pressed else 1f,
        animationSpec = spring(dampingRatio = 0.6f, stiffness = Spring.StiffnessMedium),
        label = "press",
    )
    graphicsLayer { scaleX = scale; scaleY = scale }
}

/** Staggered reveal for list items the first time they compose. */
fun Modifier.staggeredReveal(index: Int, enabled: Boolean = true): Modifier = composed {
    val reduced = Kaze.reducedMotion
    if (reduced || !enabled) return@composed this
    val progress = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        delay((index.coerceAtMost(8) * 45L))
        progress.animateTo(1f, spring(dampingRatio = 0.8f, stiffness = Spring.StiffnessLow))
    }
    graphicsLayer {
        alpha = progress.value
        translationY = (1f - progress.value) * 36f
    }
}
