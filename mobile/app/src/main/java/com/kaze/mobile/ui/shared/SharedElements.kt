package com.kaze.mobile.ui.shared

import androidx.compose.animation.AnimatedVisibilityScope
import androidx.compose.animation.ExperimentalSharedTransitionApi
import androidx.compose.animation.SharedTransitionScope
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import com.kaze.mobile.core.designsystem.theme.LocalReducedMotion

@OptIn(ExperimentalSharedTransitionApi::class)
val LocalSharedTransitionScope = compositionLocalOf<SharedTransitionScope?> { null }
val LocalNavAnimatedScope = compositionLocalOf<AnimatedVisibilityScope?> { null }

/**
 * Signature interaction #2 — poster expansion: the tapped poster morphs into the
 * detail header. Keys include the rail name so the same anime in two rails never collides.
 */
@OptIn(ExperimentalSharedTransitionApi::class)
fun Modifier.sharedPoster(key: String?): Modifier = composed {
    val shared = LocalSharedTransitionScope.current
    val anim = LocalNavAnimatedScope.current
    if (key == null || shared == null || anim == null || LocalReducedMotion.current) return@composed this
    with(shared) {
        this@composed.sharedElement(rememberSharedContentState("poster-$key"), anim)
    }
}
