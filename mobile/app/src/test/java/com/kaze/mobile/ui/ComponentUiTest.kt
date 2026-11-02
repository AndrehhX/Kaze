package com.kaze.mobile.ui

import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.kaze.mobile.core.designsystem.components.ErrorState
import com.kaze.mobile.core.designsystem.components.SpoilerShield
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.core.designsystem.theme.KazeTheme
import com.kaze.mobile.core.designsystem.theme.KazeThemeId
import com.kaze.mobile.core.designsystem.theme.Ornament
import com.kaze.mobile.feature.settings.ThemePreviewCard
import com.kaze.mobile.navigation.KazeBottomBar
import com.kaze.mobile.navigation.TopLevel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(AndroidJUnit4::class)
@Config(sdk = [34], application = android.app.Application::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ComponentUiTest {
    @get:Rule val rule = createComposeRule()

    @Test fun spoilerShield_hidesContentUntilRevealed() {
        rule.setContent { KazeTheme(KazeThemeId.MIDNIGHT_NEON, reducedMotion = true) { SpoilerShield(true) { Text("The twist") } } }
        rule.onNodeWithText("The twist").assertDoesNotExist()
        rule.onNodeWithText("Spoiler — tap to reveal").performClick()
        rule.waitForIdle()
        rule.onNodeWithText("The twist").assertExists()
        rule.onNodeWithContentDescription("Hide spoiler again").performClick()
        rule.waitForIdle()
        rule.onNodeWithText("The twist").assertDoesNotExist()
    }

    @Test fun nonSpoiler_isShownImmediately() {
        rule.setContent { KazeTheme(KazeThemeId.ZEN_STUDIO) { SpoilerShield(false) { Text("Safe text") } } }
        rule.onNodeWithText("Safe text").assertExists()
    }

    @Test fun themeSwitching_changesDesignLanguageNotJustColour() {
        var theme by mutableStateOf(KazeThemeId.MIDNIGHT_NEON)
        var ornament: Ornament? = null
        var uppercase: Boolean? = null
        rule.setContent {
            KazeTheme(theme, reducedMotion = true) {
                ornament = Kaze.style.ornament
                uppercase = Kaze.style.uppercaseLabels
                Text("x")
            }
        }
        assertEquals(Ornament.GLOW, ornament)
        theme = KazeThemeId.CYBER_PULSE
        rule.waitForIdle()
        assertEquals(Ornament.CIRCUIT, ornament)
        assertEquals(true, uppercase)
        theme = KazeThemeId.ZEN_STUDIO
        rule.waitForIdle()
        assertEquals(Ornament.EDITORIAL, ornament)
    }

    @Test fun themePreview_selectionCallback() {
        var picked: KazeThemeId? = null
        rule.setContent { KazeTheme(KazeThemeId.MIDNIGHT_NEON, reducedMotion = true) { ThemePreviewCard(KazeThemeId.SAKURA_DREAM, selected = false) { picked = KazeThemeId.SAKURA_DREAM } } }
        rule.onNodeWithContentDescription("Sakura Dream: Modern Japanese pastel").performClick()
        assertEquals(KazeThemeId.SAKURA_DREAM, picked)
    }

    @Test fun bottomBar_navigatesAndMarksSelection() {
        var selected by mutableStateOf(0)
        val clicks = mutableListOf<TopLevel>()
        rule.setContent {
            KazeTheme(KazeThemeId.CYBER_PULSE, reducedMotion = true) {
                KazeBottomBar(selected, { clicks += it; selected = it.ordinal })
            }
        }
        rule.onNodeWithText("LIBRARY").performClick()
        rule.waitForIdle()
        assertEquals(listOf(TopLevel.LIBRARY), clicks)
        rule.onNodeWithText("LIBRARY").assertIsSelected()
    }

    @Test fun errorState_offersRetry() {
        var retried = false
        rule.setContent { KazeTheme(KazeThemeId.SAKURA_DREAM) { ErrorState("No connection", offline = true, onRetry = { retried = true }) } }
        rule.onNodeWithText("You're offline").assertExists()
        rule.onNodeWithText("Try again").performClick()
        assertTrue(retried)
        assertTrue(rule.onAllNodesWithText("No connection").fetchSemanticsNodes().isNotEmpty())
    }
}
