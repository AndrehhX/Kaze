package com.kaze.mobile.ui

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performScrollToIndex
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performImeAction
import androidx.compose.ui.test.printToString
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasScrollToNodeAction
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.kaze.mobile.MainActivity
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Boots the real application (Hilt graph, Room, DataStore, WorkManager) and drives the main
 * guest flows. Catalogue steps hit the live AniList API, so this test needs network access.
 */
@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
@Config(sdk = [34], qualifiers = "w411dp-h891dp-xxhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class AppSmokeTest {
    @get:Rule val rule = createAndroidComposeRule<MainActivity>()

    private fun waitForText(text: String, timeout: Long = 30_000) = try {
        rule.waitUntil(timeout) { rule.onAllNodesWithText(text, substring = true, ignoreCase = true).fetchSemanticsNodes().isNotEmpty() }
    } catch (e: Throwable) {
        println("TREE-DUMP " + rule.onAllNodes(androidx.compose.ui.test.isRoot()).onFirst().printToString(maxDepth = 30))
        throw AssertionError("Timed out waiting for \"$text\"", e)
    }

    @Test fun guestJourney_onboardingHomeDiscoverSearchDetailLibraryProfileThemes() {
        // Onboarding
        waitForText("Your Anime Universe")
        rule.onNodeWithText("Continue", ignoreCase = true).performClick()
        waitForText("Choose your world")
        rule.onNodeWithContentDescription("Cyber Pulse: High-tech anime cyberpunk").performClick()
        rule.onNodeWithText("Continue", ignoreCase = true).performClick()
        waitForText("What do you love?")
        rule.onNodeWithText("Psychological", ignoreCase = true).performClick()
        rule.onNodeWithText("Enter KAZE", ignoreCase = true).performClick()

        // Home loads real AniList data (Cyber Pulse uppercases labels)
        waitForText("TRENDING", 45_000)
        rule.onAllNodes(hasScrollToNodeAction()).onFirst().performScrollToNode(hasText("POPULAR THIS SEASON", ignoreCase = true))
        waitForText("POPULAR THIS SEASON")

        // Discover → Mood Explorer
        rule.onNodeWithText("DISCOVER", ignoreCase = true).performClick()
        waitForText("Mood Explorer")
        rule.onNodeWithText("Mood Explorer", ignoreCase = true).performClick()
        waitForText("How do you want to feel tonight?")
        rule.onNodeWithContentDescription("Back").performClick()

        // Search → open a real detail page
        waitForText("Search 20,000+ anime")
        rule.onNodeWithText("Search 20,000+ anime on AniList", ignoreCase = true).performClick()
        rule.onNodeWithContentDescription("Search anime").performTextInput("Frieren")
        rule.onNodeWithContentDescription("Search anime").performImeAction()
        try { rule.waitUntil(45_000) { rule.onAllNodes(hasContentDescription("Frieren", substring = true)).fetchSemanticsNodes().isNotEmpty() } }
        catch (e: Throwable) {
            println("TREE-DUMP " + rule.onAllNodes(androidx.compose.ui.test.isRoot()).onFirst().printToString(maxDepth = 30))
            throw AssertionError("Search results for Frieren never appeared", e)
        }
        rule.onAllNodes(hasContentDescription("Frieren", substring = true)).onFirst().performClick()
        waitForText("Watch EP", 45_000)
        rule.onAllNodes(hasScrollToNodeAction()).onFirst().performScrollToNode(hasText("Characters & voice cast", ignoreCase = true))
        waitForText("Characters & voice cast")
        rule.onAllNodes(hasScrollToNodeAction()).onFirst().performScrollToIndex(0)

        // Add to library from the detail page
        rule.onAllNodes(hasText("ADD", ignoreCase = true)).onFirst().performClick()
        waitForText("STATUS")
        rule.onNodeWithText("WATCHING", ignoreCase = true).performClick()
        rule.waitForIdle()
        androidx.test.espresso.Espresso.pressBack()
        rule.onNodeWithContentDescription("Back").performClick()
        rule.onNodeWithContentDescription("Back").performClick()

        // Library shows the persisted entry
        rule.onNodeWithText("LIBRARY", ignoreCase = true).performClick()
        waitForText("1 title ·")

        // Profile → Settings → Appearance → switch to Zen Studio
        rule.onNodeWithText("PROFILE", ignoreCase = true).performClick()
        waitForText("Guest profile")
        rule.onNodeWithContentDescription("Settings").performClick()
        waitForText("Appearance")
        rule.onNodeWithText("Appearance", ignoreCase = true).performClick()
        rule.onNodeWithContentDescription("Zen Studio: Japanese editorial minimalism").performClick()
        rule.waitForIdle()
        rule.onNode(hasScrollAction()).performScrollToNode(hasText("Reduce motion"))
        waitForText("Reduce motion")
    }
}
