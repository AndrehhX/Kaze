package com.kaze.mobile.core.designsystem.theme

import android.os.Build
import android.provider.Settings
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.State
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

val LocalKazeColors = staticCompositionLocalOf { KazePalettes.MidnightNeon }
val LocalKazeStyle = staticCompositionLocalOf { KazeStyles.of(KazeThemeId.MIDNIGHT_NEON) }
val LocalKazeTypography = staticCompositionLocalOf { KazeTypographies.of(KazeStyles.of(KazeThemeId.MIDNIGHT_NEON)) }

/** True when the user (or the system animator scale) asked for reduced motion. */
val LocalReducedMotion = staticCompositionLocalOf { false }

/** Whether optional ambient decorations (sakura petals, scanlines, glows) should animate. */
val LocalAmbientEffects = staticCompositionLocalOf { true }

object Kaze {
    val colors: KazeColors @Composable get() = LocalKazeColors.current
    val style: KazeStyle @Composable get() = LocalKazeStyle.current
    val type: KazeTypography @Composable get() = LocalKazeTypography.current
    val reducedMotion: Boolean @Composable get() = LocalReducedMotion.current
}

@Composable
fun systemAnimationsDisabled(): Boolean {
    val context = LocalContext.current
    return remember {
        runCatching {
            Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
        }.getOrDefault(false)
    }
}

/**
 * Root theme. Palette changes animate token-by-token so switching worlds feels like a
 * cross-dissolve of the whole interface rather than a hard cut.
 */
@Composable
fun KazeTheme(
    themeId: KazeThemeId,
    reducedMotion: Boolean = false,
    ambientEffects: Boolean = true,
    wallpaperAccent: Boolean = false,
    highContrast: Boolean = false,
    content: @Composable () -> Unit,
) {
    val reduce = reducedMotion || systemAnimationsDisabled()
    var target = KazePalettes.of(themeId)
    if (wallpaperAccent && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val ctx = LocalContext.current
        val dyn = if (themeId.isDark) dynamicDarkColorScheme(ctx) else dynamicLightColorScheme(ctx)
        target = target.copy(primary = dyn.primary, secondary = dyn.tertiary, onPrimary = dyn.onPrimary)
    }
    if (highContrast) {
        target = target.copy(
            textMuted = target.text.copy(alpha = 0.92f),
            outline = target.text.copy(alpha = 0.5f),
        )
    }
    val colors = animateColors(target, if (reduce) 0 else 650)
    val style = remember(themeId) { KazeStyles.of(themeId) }
    val typography = remember(style) { KazeTypographies.of(style) }

    CompositionLocalProvider(
        LocalKazeColors provides colors,
        LocalKazeStyle provides style,
        LocalKazeTypography provides typography,
        LocalReducedMotion provides reduce,
        LocalAmbientEffects provides (ambientEffects && !reduce),
    ) {
        MaterialTheme(
            colorScheme = colors.toMaterial(themeId.isDark),
            typography = typography.toMaterial(),
            content = content,
        )
    }
}

@Composable
private fun animateColors(target: KazeColors, durationMs: Int): KazeColors {
    @Composable
    fun anim(c: Color): State<Color> = animateColorAsState(c, tween(durationMs), label = "theme")
    return KazeColors(
        background = anim(target.background).value,
        surface = anim(target.surface).value,
        surfaceHigh = anim(target.surfaceHigh).value,
        primary = anim(target.primary).value,
        secondary = anim(target.secondary).value,
        accent = anim(target.accent).value,
        text = anim(target.text).value,
        textMuted = anim(target.textMuted).value,
        outline = anim(target.outline).value,
        onPrimary = anim(target.onPrimary).value,
        scrim = anim(target.scrim).value,
        success = target.success,
        warning = target.warning,
        error = target.error,
    )
}

private fun KazeColors.toMaterial(dark: Boolean): ColorScheme {
    val base = if (dark) darkColorScheme() else lightColorScheme()
    return base.copy(
        primary = primary,
        onPrimary = onPrimary,
        primaryContainer = primary.copy(alpha = 0.18f),
        onPrimaryContainer = text,
        secondary = secondary,
        onSecondary = onPrimary,
        secondaryContainer = secondary.copy(alpha = 0.18f),
        onSecondaryContainer = text,
        tertiary = accent,
        background = background,
        onBackground = text,
        surface = surface,
        onSurface = text,
        surfaceVariant = surfaceHigh,
        onSurfaceVariant = textMuted,
        surfaceContainer = surface,
        surfaceContainerHigh = surfaceHigh,
        surfaceContainerHighest = surfaceHigh,
        surfaceContainerLow = surface,
        surfaceContainerLowest = background,
        outline = outline,
        outlineVariant = outline,
        error = error,
        scrim = scrim,
    )
}

private fun KazeTypography.toMaterial(): Typography = Typography(
    displayLarge = display,
    displayMedium = display,
    displaySmall = headline,
    headlineLarge = headline,
    headlineMedium = headline,
    headlineSmall = title,
    titleLarge = title,
    titleMedium = titleSmall,
    titleSmall = titleSmall,
    bodyLarge = body,
    bodyMedium = body,
    bodySmall = bodySmall,
    labelLarge = label,
    labelMedium = label,
    labelSmall = overline,
)
