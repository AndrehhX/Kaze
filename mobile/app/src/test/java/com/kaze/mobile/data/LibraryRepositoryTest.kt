package com.kaze.mobile.data

import android.content.Context
import android.net.Uri
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.kaze.mobile.DeepLinkRouter
import com.kaze.mobile.core.database.KazeDatabase
import com.kaze.mobile.core.text.SafeRichText
import com.kaze.mobile.data.anilist.Clock
import com.kaze.mobile.data.backend.SupabaseClient
import com.kaze.mobile.data.backend.parseIsoMillis
import com.kaze.mobile.data.library.CollectionsRepository
import com.kaze.mobile.data.library.LibraryRepository
import com.kaze.mobile.data.library.ProgressRepository
import com.kaze.mobile.domain.model.Anime
import com.kaze.mobile.domain.model.LibraryStatus
import com.kaze.mobile.domain.sync.ConflictChoice
import com.kaze.mobile.domain.sync.RemoteEntry
import com.kaze.mobile.domain.sync.SyncPlanner
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.security.MessageDigest

@RunWith(AndroidJUnit4::class)
@Config(sdk = [34], application = android.app.Application::class)
class LibraryRepositoryTest {
    private lateinit var db: KazeDatabase
    private lateinit var library: LibraryRepository
    private lateinit var collections: CollectionsRepository
    private lateinit var progress: ProgressRepository
    private var now = 1_000L
    private val clock = Clock { now }
    private val anime = Anime(id = 1, title = "Sousou no Frieren", titleEnglish = "Frieren", episodes = 28, genres = listOf("Adventure", "Drama"), coverUrl = "https://c/1.jpg")

    @Before fun setUp() {
        val ctx = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(ctx, KazeDatabase::class.java).allowMainThreadQueries().build()
        library = LibraryRepository(db, db.libraryDao(), db.collectionDao(), db.activityDao(), clock, Json)
        collections = CollectionsRepository(db, db.collectionDao(), clock)
        progress = ProgressRepository(db.playbackDao(), clock)
    }

    @After fun tearDown() = db.close()

    @Test fun addProgressAndAutoComplete() = runTest {
        library.addOrUpdate(anime, LibraryStatus.PLANNING)
        assertEquals(LibraryStatus.PLANNING, library.entry(1).first()!!.status)
        assertFalse(library.setProgress(1, 3))
        assertEquals("progress moves Planning → Watching", LibraryStatus.WATCHING, library.entry(1).first()!!.status)
        assertTrue("reaching the last episode completes", library.setProgress(1, 28))
        val e = library.entry(1).first()!!
        assertEquals(LibraryStatus.COMPLETED, e.status)
        assertNotNull(e.completedAt)
        assertEquals("progress never exceeds the episode count", 28, library.run { setProgress(1, 99); entry(1).first()!!.progress })
    }

    @Test fun favouritesScoresAndBulkOperations() = runTest {
        library.toggleFavorite(anime)
        library.setScore(1, 140)
        library.addOrUpdate(anime.copy(id = 2, title = "Mushishi", titleEnglish = null), LibraryStatus.WATCHING)
        val e = library.entry(1).first()!!
        assertTrue(e.isFavorite)
        assertEquals("scores are clamped to 100", 100, e.userScore)
        library.bulkSetStatus(listOf(1, 2), LibraryStatus.PAUSED)
        assertTrue(library.snapshot().all { it.status == LibraryStatus.PAUSED })
        library.remove(listOf(1, 2))
        assertTrue(library.snapshot().isEmpty())
    }

    @Test fun exportImport_mergesKeepingNewer() = runTest {
        library.addOrUpdate(anime, LibraryStatus.WATCHING)
        library.setProgress(1, 5)
        val json = library.exportJson()
        now += 10_000
        library.setProgress(1, 9)            // local is now newer than the export
        val report = library.importJson(json)
        assertEquals(1, report.skippedOlder)
        assertEquals(9, library.entry(1).first()!!.progress)
        library.remove(listOf(1))
        val again = library.importJson(json)
        assertEquals(1, again.added)
    }

    @Test fun conflictResolution_keepLocalOrUseRemote() = runTest {
        library.addOrUpdate(anime, LibraryStatus.WATCHING)
        library.setProgress(1, 7)
        val plan = SyncPlanner.plan(library.snapshot(), listOf(RemoteEntry(1, LibraryStatus.WATCHING, 12, 80, 50)))
        assertEquals(1, plan.conflicts.size)
        library.resolveConflict(plan.conflicts.first(), ConflictChoice.KEEP_LOCAL, null)
        assertEquals(7, library.entry(1).first()!!.progress)
        assertTrue(library.entry(1).first()!!.dirty)
        library.resolveConflict(plan.conflicts.first(), ConflictChoice.USE_REMOTE, anime)
        val e = library.entry(1).first()!!
        assertEquals(12, e.progress)
        assertEquals(80, e.userScore)
        assertFalse(e.dirty)
    }

    @Test fun collections_createAddReorderDelete() = runTest {
        val id = collections.create("  Comfort  ", "rainy days", isPublic = false)
        collections.add(id, anime)
        collections.add(id, anime.copy(id = 2, title = "Mushishi", titleEnglish = null))
        collections.reorderItems(id, listOf(2, 1))
        val col = collections.collection(id).first()!!
        assertEquals("Comfort", col.name)
        assertEquals(listOf(2, 1), col.items.map { it.animeId })
        collections.delete(id)
        assertNull(collections.collection(id).first())
    }

    @Test fun playbackProgress_continueWatchingKeepsLatestEpisodePerAnime() = runTest {
        progress.save(1, 1, "Frieren", null, null, 1_400_000, 1_440_000) // completed (>92%)
        now += 1
        progress.save(1, 2, "Frieren", null, null, 300_000, 1_440_000)
        val cw = progress.continueWatching.first()
        assertEquals(1, cw.size)
        assertEquals(2, cw.first().episode)
        assertTrue(progress.get(1, 1)!!.completed)
        assertFalse(progress.get(1, 2)!!.completed)
    }

    @Test fun playbackProgress_aBarelyStartedEpisodeIsNotResumable() = runTest {
        // Found on device: opening the player and leaving at once put the title in "Continue watching".
        progress.save(2, 3, "Frieren", null, null, 8, 600_000)
        assertEquals(null, progress.get(2, 3))
        assertTrue(progress.continueWatching.first().isEmpty())
        // Once an episode has real progress, later saves (e.g. after seeking back to the start) still apply.
        progress.save(2, 3, "Frieren", null, null, 120_000, 600_000)
        now += 1
        progress.save(2, 3, "Frieren", null, null, 2_000, 600_000)
        assertEquals(2_000, progress.get(2, 3)!!.positionMs)
    }
}

@RunWith(AndroidJUnit4::class)
@Config(sdk = [34], application = android.app.Application::class)
class SecurityAndTextTest {
    @Test fun anilistHtml_isReducedToPlainText_withSpoilersHidden() {
        val plain = SafeRichText.htmlToPlain("<p>Hello&nbsp;<b>world</b><br>Line &amp; more ~!secret ending!~ <script>alert(1)</script></p>")
        assertTrue(plain.startsWith("Hello world\nLine & more [spoiler hidden]"))
        assertFalse(plain.contains("<"))
        val annotated = SafeRichText.htmlToAnnotated("<i>Italic</i> and <b>bold</b>")
        assertEquals("Italic and bold", annotated.text)
        assertEquals(2, annotated.spanStyles.size)
    }

    @Test fun markdownLite_hidesInlineSpoilersUntilRevealed() {
        val hidden = SafeRichText.markdownLite("**Big** twist: ||he lives||", revealSpoilers = false, spoilerColor = androidx.compose.ui.graphics.Color.Black, codeBackground = androidx.compose.ui.graphics.Color.Gray)
        assertEquals("Big twist: he lives", hidden.text)
        assertTrue(hidden.spanStyles.any { it.item.background == androidx.compose.ui.graphics.Color.Black && it.item.color == androidx.compose.ui.graphics.Color.Black })
        assertTrue(SafeRichText.containsInlineSpoiler("x ||y|| z"))
    }

    @Test fun userInput_stripsControlAndBidiCharacters() {
        assertEquals("abc", SafeRichText.sanitizeUserInput("  a\u0000b‮c  "))
        assertEquals(5, SafeRichText.sanitizeUserInput("abcdefgh", 5).length)
    }

    @Test fun deepLinks_onlyAcceptKnownSafeShapes() {
        assertTrue(DeepLinkRouter.isSafeContentLink(Uri.parse("kaze://anime/154587")))
        assertTrue(DeepLinkRouter.isSafeContentLink(Uri.parse("kaze://party/AB12CD")))
        assertFalse(DeepLinkRouter.isSafeContentLink(Uri.parse("kaze://evil/1")))
        assertFalse(DeepLinkRouter.isSafeContentLink(Uri.parse("https://anime/1")))
        assertFalse(DeepLinkRouter.isSafeContentLink(Uri.parse("kaze://anime/..%2F..%2Fetc")))
    }

    @Test fun pkce_challengeIsS256OfVerifier() {
        val (verifier, challenge) = SupabaseClient.newPkce()
        assertTrue(verifier.length >= 43)
        val digest = MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray())
        val expected = android.util.Base64.encodeToString(digest, android.util.Base64.URL_SAFE or android.util.Base64.NO_PADDING or android.util.Base64.NO_WRAP)
        assertEquals(expected, challenge)
        assertFalse(challenge.contains("=") || challenge.contains("+") || challenge.contains("/"))
    }

    @Test fun supabaseTimestamps_parse() {
        assertEquals(1_700_000_000_000L, parseIsoMillis("2023-11-14T22:13:20+00:00"))
        assertEquals(1_700_000_000_000L, parseIsoMillis("2023-11-14T22:13:20Z"))
        assertEquals(1_700_000_000_123L, parseIsoMillis("2023-11-14 22:13:20.123+00:00"))
        assertEquals(0L, parseIsoMillis("garbage"))
    }
}
