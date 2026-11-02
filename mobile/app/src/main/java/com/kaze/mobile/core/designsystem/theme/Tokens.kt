package com.kaze.mobile.core.designsystem.theme

import androidx.compose.foundation.shape.CutCornerShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp

/** The four KAZE visual worlds. Each changes the whole design language, not just the accent. */
enum class KazeThemeId(
    val label: String,
    val tagline: String,
    val isDark: Boolean,
) {
    MIDNIGHT_NEON("Midnight Neon", "Dark futuristic anime metropolis", true),
    SAKURA_DREAM("Sakura Dream", "Modern Japanese pastel", false),
    CYBER_PULSE("Cyber Pulse", "High-tech anime cyberpunk", true),
    ZEN_STUDIO("Zen Studio", "Japanese editorial minimalism", false);

    companion object {
        fun fromKey(key: String?): KazeThemeId = entries.firstOrNull { it.name == key } ?: MIDNIGHT_NEON
    }
}

@Immutable
data class KazeColors(
    val background: Color,
    val surface: Color,
    val surfaceHigh: Color,
    val primary: Color,
    val secondary: Color,
    val accent: Color,
    val text: Color,
    val textMuted: Color,
    val outline: Color,
    val onPrimary: Color,
    val scrim: Color,
    val success: Color,
    val warning: Color,
    val error: Color,
) {
    /** Accent for *text*: light themes' accents are decorative pastels, so text falls back to primary for contrast. */
    val accentText: Color get() = if (isLight) primary else accent
    val isLight: Boolean get() = background.luminance() > 0.5f
}

/** How components render in a theme: shape vocabulary, ornamentation, motion personality. */
enum class MotionPersonality { SPRING, SOFT, DIRECTIONAL, MINIMAL }
enum class Ornament { GLOW, PETAL, CIRCUIT, EDITORIAL }

@Immutable
data class KazeStyle(
    val id: KazeThemeId,
    val cardShape: Shape,
    val posterShape: Shape,
    val chipShape: Shape,
    val buttonShape: Shape,
    val sheetShape: Shape,
    val cornerRadius: Dp,
    val borderWidth: Dp,
    val glow: Boolean,
    val ornament: Ornament,
    val motion: MotionPersonality,
    val displayFamily: FontFamily,
    val bodyFamily: FontFamily,
    val labelFamily: FontFamily,
    val uppercaseLabels: Boolean,
)

@Immutable
data class KazeTypography(
    val display: TextStyle,
    val headline: TextStyle,
    val title: TextStyle,
    val titleSmall: TextStyle,
    val body: TextStyle,
    val bodySmall: TextStyle,
    val label: TextStyle,
    val overline: TextStyle,
)

object KazePalettes {
    val MidnightNeon = KazeColors(
        background = Color(0xFF080810),
        surface = Color(0xFF12121F),
        surfaceHigh = Color(0xFF1C1B2E),
        primary = Color(0xFFA855F7),
        secondary = Color(0xFF6D5EF8),
        accent = Color(0xFFFF4FD8),
        text = Color(0xFFF7F5FF),
        textMuted = Color(0xFFADA8C7),
        outline = Color(0x33A855F7),
        onPrimary = Color(0xFFFFFFFF),
        scrim = Color(0xCC080810),
        success = Color(0xFF4ADE80),
        warning = Color(0xFFFBBF24),
        error = Color(0xFFFF6B8B),
    )
    val SakuraDream = KazeColors(
        background = Color(0xFFFFF9FB),
        surface = Color(0xFFFFFFFF),
        surfaceHigh = Color(0xFFFDEEF4),
        primary = Color(0xFFE86A9A),
        secondary = Color(0xFFB89AF7),
        accent = Color(0xFFF7B7D2),
        text = Color(0xFF342A39),
        textMuted = Color(0xFF7D6E84),
        outline = Color(0x33E86A9A),
        // Dark ink on sakura pink keeps WCAG AA contrast (white would be ~3:1).
        onPrimary = Color(0xFF2A1F2F),
        scrim = Color(0xB3FFF9FB),
        success = Color(0xFF3FA77A),
        warning = Color(0xFFD08A1E),
        error = Color(0xFFD64561),
    )
    val CyberPulse = KazeColors(
        background = Color(0xFF050D16),
        surface = Color(0xFF0B1A28),
        surfaceHigh = Color(0xFF102538),
        primary = Color(0xFF00D9FF),
        secondary = Color(0xFF287BFF),
        accent = Color(0xFFB3FF39),
        text = Color(0xFFEAFBFF),
        textMuted = Color(0xFF8FB3C4),
        outline = Color(0x4400D9FF),
        onPrimary = Color(0xFF02121C),
        scrim = Color(0xCC050D16),
        success = Color(0xFFB3FF39),
        warning = Color(0xFFFFC53D),
        error = Color(0xFFFF4D6D),
    )
    val ZenStudio = KazeColors(
        background = Color(0xFFF5F2EA),
        surface = Color(0xFFFFFFFF),
        surfaceHigh = Color(0xFFEDE7DA),
        primary = Color(0xFFE96B35),
        secondary = Color(0xFF242424),
        accent = Color(0xFFC8B9A4),
        text = Color(0xFF1D1D1D),
        textMuted = Color(0xFF6B655C),
        outline = Color(0x22242424),
        onPrimary = Color(0xFF1D1D1D),
        scrim = Color(0xB3F5F2EA),
        success = Color(0xFF3C8D5A),
        warning = Color(0xFFB7791F),
        error = Color(0xFFC0392B),
    )

    fun of(id: KazeThemeId): KazeColors = when (id) {
        KazeThemeId.MIDNIGHT_NEON -> MidnightNeon
        KazeThemeId.SAKURA_DREAM -> SakuraDream
        KazeThemeId.CYBER_PULSE -> CyberPulse
        KazeThemeId.ZEN_STUDIO -> ZenStudio
    }
}

object KazeStyles {
    fun of(id: KazeThemeId): KazeStyle = when (id) {
        KazeThemeId.MIDNIGHT_NEON -> KazeStyle(
            id = id,
            cardShape = RoundedCornerShape(20.dp),
            posterShape = RoundedCornerShape(16.dp),
            chipShape = RoundedCornerShape(50),
            buttonShape = RoundedCornerShape(50),
            sheetShape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp),
            cornerRadius = 20.dp,
            borderWidth = 1.dp,
            glow = true,
            ornament = Ornament.GLOW,
            motion = MotionPersonality.SPRING,
            displayFamily = FontFamily.SansSerif,
            bodyFamily = FontFamily.SansSerif,
            labelFamily = FontFamily.SansSerif,
            uppercaseLabels = false,
        )
        KazeThemeId.SAKURA_DREAM -> KazeStyle(
            id = id,
            cardShape = RoundedCornerShape(28.dp),
            posterShape = RoundedCornerShape(24.dp),
            chipShape = RoundedCornerShape(50),
            buttonShape = RoundedCornerShape(50),
            sheetShape = RoundedCornerShape(topStart = 36.dp, topEnd = 36.dp),
            cornerRadius = 28.dp,
            borderWidth = 0.dp,
            glow = false,
            ornament = Ornament.PETAL,
            motion = MotionPersonality.SOFT,
            displayFamily = FontFamily.SansSerif,
            bodyFamily = FontFamily.SansSerif,
            labelFamily = FontFamily.SansSerif,
            uppercaseLabels = false,
        )
        KazeThemeId.CYBER_PULSE -> KazeStyle(
            id = id,
            cardShape = CutCornerShape(topStart = 0.dp, topEnd = 14.dp, bottomEnd = 0.dp, bottomStart = 14.dp),
            posterShape = CutCornerShape(topStart = 0.dp, topEnd = 12.dp, bottomEnd = 0.dp, bottomStart = 0.dp),
            chipShape = CutCornerShape(6.dp),
            buttonShape = CutCornerShape(topStart = 10.dp, bottomEnd = 10.dp),
            sheetShape = CutCornerShape(topStart = 22.dp, topEnd = 0.dp),
            cornerRadius = 4.dp,
            borderWidth = 1.dp,
            glow = true,
            ornament = Ornament.CIRCUIT,
            motion = MotionPersonality.DIRECTIONAL,
            displayFamily = FontFamily.SansSerif,
            bodyFamily = FontFamily.SansSerif,
            labelFamily = FontFamily.Monospace,
            uppercaseLabels = true,
        )
        KazeThemeId.ZEN_STUDIO -> KazeStyle(
            id = id,
            cardShape = RoundedCornerShape(6.dp),
            posterShape = RoundedCornerShape(4.dp),
            chipShape = RoundedCornerShape(4.dp),
            buttonShape = RoundedCornerShape(4.dp),
            sheetShape = RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp),
            cornerRadius = 6.dp,
            borderWidth = 1.dp,
            glow = false,
            ornament = Ornament.EDITORIAL,
            motion = MotionPersonality.MINIMAL,
            displayFamily = FontFamily.Serif,
            bodyFamily = FontFamily.SansSerif,
            labelFamily = FontFamily.SansSerif,
            uppercaseLabels = true,
        )
    }
}

object KazeTypographies {
    fun of(style: KazeStyle): KazeTypography {
        val d = style.displayFamily
        val b = style.bodyFamily
        val l = style.labelFamily
        return when (style.id) {
            KazeThemeId.MIDNIGHT_NEON -> KazeTypography(
                display = TextStyle(fontFamily = d, fontWeight = FontWeight.Black, fontSize = 40.sp, lineHeight = 42.sp, letterSpacing = (-0.03).em),
                headline = TextStyle(fontFamily = d, fontWeight = FontWeight.ExtraBold, fontSize = 26.sp, lineHeight = 30.sp, letterSpacing = (-0.02).em),
                title = TextStyle(fontFamily = d, fontWeight = FontWeight.Bold, fontSize = 19.sp, lineHeight = 24.sp),
                titleSmall = TextStyle(fontFamily = b, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, lineHeight = 18.sp),
                body = TextStyle(fontFamily = b, fontWeight = FontWeight.Normal, fontSize = 15.sp, lineHeight = 22.sp),
                bodySmall = TextStyle(fontFamily = b, fontWeight = FontWeight.Normal, fontSize = 13.sp, lineHeight = 18.sp),
                label = TextStyle(fontFamily = l, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, letterSpacing = 0.02.em),
                overline = TextStyle(fontFamily = l, fontWeight = FontWeight.Bold, fontSize = 11.sp, letterSpacing = 0.18.em),
            )
            KazeThemeId.SAKURA_DREAM -> KazeTypography(
                display = TextStyle(fontFamily = d, fontWeight = FontWeight.Light, fontSize = 38.sp, lineHeight = 44.sp, letterSpacing = (-0.01).em),
                headline = TextStyle(fontFamily = d, fontWeight = FontWeight.Medium, fontSize = 25.sp, lineHeight = 31.sp),
                title = TextStyle(fontFamily = d, fontWeight = FontWeight.Medium, fontSize = 18.sp, lineHeight = 24.sp),
                titleSmall = TextStyle(fontFamily = b, fontWeight = FontWeight.Medium, fontSize = 14.sp, lineHeight = 19.sp),
                body = TextStyle(fontFamily = b, fontWeight = FontWeight.Normal, fontSize = 15.sp, lineHeight = 24.sp, letterSpacing = 0.01.em),
                bodySmall = TextStyle(fontFamily = b, fontWeight = FontWeight.Normal, fontSize = 13.sp, lineHeight = 19.sp),
                label = TextStyle(fontFamily = l, fontWeight = FontWeight.Medium, fontSize = 13.sp, letterSpacing = 0.03.em),
                overline = TextStyle(fontFamily = l, fontWeight = FontWeight.Medium, fontSize = 11.sp, letterSpacing = 0.12.em),
            )
            KazeThemeId.CYBER_PULSE -> KazeTypography(
                display = TextStyle(fontFamily = d, fontWeight = FontWeight.Black, fontSize = 36.sp, lineHeight = 38.sp, letterSpacing = 0.02.em),
                headline = TextStyle(fontFamily = d, fontWeight = FontWeight.Bold, fontSize = 24.sp, lineHeight = 28.sp, letterSpacing = 0.04.em),
                title = TextStyle(fontFamily = d, fontWeight = FontWeight.Bold, fontSize = 17.sp, lineHeight = 22.sp, letterSpacing = 0.03.em),
                titleSmall = TextStyle(fontFamily = b, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, lineHeight = 18.sp),
                body = TextStyle(fontFamily = b, fontWeight = FontWeight.Normal, fontSize = 15.sp, lineHeight = 22.sp),
                bodySmall = TextStyle(fontFamily = b, fontWeight = FontWeight.Normal, fontSize = 13.sp, lineHeight = 18.sp),
                label = TextStyle(fontFamily = l, fontWeight = FontWeight.Medium, fontSize = 12.sp, letterSpacing = 0.08.em),
                overline = TextStyle(fontFamily = l, fontWeight = FontWeight.Bold, fontSize = 10.sp, letterSpacing = 0.24.em),
            )
            KazeThemeId.ZEN_STUDIO -> KazeTypography(
                display = TextStyle(fontFamily = d, fontWeight = FontWeight.Normal, fontSize = 40.sp, lineHeight = 46.sp, letterSpacing = (-0.02).em),
                headline = TextStyle(fontFamily = d, fontWeight = FontWeight.Normal, fontSize = 27.sp, lineHeight = 33.sp, letterSpacing = (-0.01).em),
                title = TextStyle(fontFamily = d, fontWeight = FontWeight.Medium, fontSize = 19.sp, lineHeight = 25.sp),
                titleSmall = TextStyle(fontFamily = b, fontWeight = FontWeight.Medium, fontSize = 14.sp, lineHeight = 19.sp),
                body = TextStyle(fontFamily = b, fontWeight = FontWeight.Normal, fontSize = 15.sp, lineHeight = 24.sp),
                bodySmall = TextStyle(fontFamily = b, fontWeight = FontWeight.Normal, fontSize = 13.sp, lineHeight = 19.sp),
                label = TextStyle(fontFamily = l, fontWeight = FontWeight.Medium, fontSize = 12.sp, letterSpacing = 0.12.em),
                overline = TextStyle(fontFamily = l, fontWeight = FontWeight.Medium, fontSize = 10.sp, letterSpacing = 0.3.em),
            )
        }
    }
}
