package com.kaze.mobile.ui

import android.graphics.Bitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasScrollToNodeAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isRoot
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performImeAction
import androidx.compose.ui.test.performScrollToIndex
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.kaze.mobile.MainActivity
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Renders real screens (live AniList data) per theme to build/screenshots for visual review.
 * Opt-in: run with -Pkaze.screenshots=true (needs network); skipped otherwise.
 */
@RunWith(AndroidJUnit4::class)
@Config(sdk = [34], qualifiers = "w411dp-h891dp-xxhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ScreenshotCapture {
    @get:Rule val rule = createAndroidComposeRule<MainActivity>()

    private val outDir = File(System.getProperty("kaze.screenshotDir") ?: "build/screenshots")

    private fun waitFor(text: String, timeout: Long = 45_000) =
        rule.waitUntil(timeout) { rule.onAllNodesWithText(text, substring = true, ignoreCase = true).fetchSemanticsNodes().isNotEmpty() }

    private fun shot(name: String) {
        rule.waitForIdle()
        Thread.sleep(2_500) // let Coil finish decoding posters
        rule.waitForIdle()
        outDir.mkdirs()
        val view = rule.activity.window.decorView
        val bmp = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
        rule.runOnUiThread { view.draw(android.graphics.Canvas(bmp)) }
        File(outDir, "$name.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 90, it) }
    }

    private fun enter(themeLabel: String) {
        waitFor("Your Anime Universe")
        shot("00_onboarding_welcome")
        rule.onNodeWithText("Continue", ignoreCase = true).performClick()
        waitFor("Choose your world")
        rule.onAllNodes(hasContentDescription(themeLabel, substring = true)).onFirst().performClick()
        shot("01_onboarding_themes")
        rule.onNodeWithText("Continue", ignoreCase = true).performClick()
        waitFor("What do you love?")
        rule.onNodeWithText("Enter KAZE", ignoreCase = true).performClick()
        waitFor("#1 TRENDING", 60_000)
    }

    private fun journey(theme: String, label: String) {
        assumeTrue(System.getProperty("kaze.screenshots") == "true")
        enter(label)
        shot("${theme}_home_hero")
        rule.onAllNodes(hasScrollToNodeAction()).onFirst().performScrollToIndex(3)
        shot("${theme}_home_rails")
        rule.onNodeWithText("Discover", ignoreCase = true).performClick()
        waitFor("Mood Explorer")
        shot("${theme}_discover")
        rule.onNodeWithText("Search 20,000+ anime on AniList", ignoreCase = true).performClick()
        rule.onNodeWithContentDescription("Search anime").performTextInput("Frieren")
        rule.onNodeWithContentDescription("Search anime").performImeAction()
        rule.waitUntil(45_000) { rule.onAllNodes(hasContentDescription("Frieren", substring = true)).fetchSemanticsNodes().isNotEmpty() }
        shot("${theme}_search")
        rule.onAllNodes(hasContentDescription("Frieren", substring = true)).onFirst().performClick()
        waitFor("Watch EP")
        shot("${theme}_detail")
        rule.onAllNodes(hasScrollToNodeAction()).onFirst().performScrollToNode(hasText("Characters & voice cast", ignoreCase = true))
        shot("${theme}_detail_characters")
        rule.onNodeWithContentDescription("Back").performClick()
        rule.onNodeWithContentDescription("Back").performClick()
        rule.onNodeWithText("Profile", ignoreCase = true).performClick()
        waitFor("Guest profile")
        shot("${theme}_profile")
    }

    @Test fun midnightNeon() = journey("neon", "Midnight Neon")
    @Test fun sakuraDream() = journey("sakura", "Sakura Dream")
    @Test fun cyberPulse() = journey("cyber", "Cyber Pulse")
    @Test fun zenStudio() = journey("zen", "Zen Studio")
}

