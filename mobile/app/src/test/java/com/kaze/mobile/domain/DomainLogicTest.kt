package com.kaze.mobile.domain

import com.kaze.mobile.domain.achievements.AchievementCatalog
import com.kaze.mobile.domain.achievements.AchievementStats
import com.kaze.mobile.domain.model.Anime
import com.kaze.mobile.domain.model.AnimeSeason
import com.kaze.mobile.domain.model.AnimeTag
import com.kaze.mobile.domain.model.LibraryEntry
import com.kaze.mobile.domain.model.LibraryFilter
import com.kaze.mobile.domain.model.LibrarySort
import com.kaze.mobile.domain.model.LibraryStatus
import com.kaze.mobile.domain.model.SearchFilters
import com.kaze.mobile.domain.model.applyFilter
import com.kaze.mobile.domain.party.ClockOffsetEstimator
import com.kaze.mobile.domain.party.PartyPlaybackState
import com.kaze.mobile.domain.party.PartyReactions
import com.kaze.mobile.domain.party.PartySync
import com.kaze.mobile.domain.party.SyncCorrection
import com.kaze.mobile.domain.playback.SkipKind
import com.kaze.mobile.domain.playback.SkipLogic
import com.kaze.mobile.domain.playback.SkipMarker
import com.kaze.mobile.domain.recommendation.AnimeDnaCalculator
import com.kaze.mobile.domain.recommendation.Mood
import com.kaze.mobile.domain.recommendation.RecommendationEngine
import com.kaze.mobile.domain.recommendation.Roulette
import com.kaze.mobile.domain.social.EmailRules
import com.kaze.mobile.domain.social.PasswordRules
import com.kaze.mobile.domain.social.UsernameRules
import com.kaze.mobile.domain.sync.RemoteEntry
import com.kaze.mobile.domain.sync.SyncPlanner
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

private fun entry(id: Int, status: LibraryStatus = LibraryStatus.WATCHING, progress: Int = 0, score: Int? = null, genres: List<String> = listOf("Action"),
                  fav: Boolean = false, updated: Long = 0, remote: Long? = null, dirty: Boolean = true, title: String = "T$id", year: Int? = 2023) =
    LibraryEntry(animeId = id, title = title, genres = genres, status = status, progress = progress, userScore = score, isFavorite = fav,
        updatedAt = updated, addedAt = updated, remoteUpdatedAt = remote, dirty = dirty, totalEpisodes = 12, seasonYear = year, studios = listOf("Madhouse"))

class SyncPlannerTest {
    @Test fun newRemote_isPulled_newLocal_isPushed() {
        val plan = SyncPlanner.plan(listOf(entry(1)), listOf(RemoteEntry(2, LibraryStatus.COMPLETED, 12, 90, 100)))
        assertEquals(listOf(2), plan.pull.map { it.animeId })
        assertEquals(listOf(1), plan.push.map { it.animeId })
        assertTrue(plan.conflicts.isEmpty())
    }

    @Test fun cleanLocal_takesRemoteChange() {
        val local = entry(1, progress = 3, remote = 100, dirty = false)
        val plan = SyncPlanner.plan(listOf(local), listOf(RemoteEntry(1, LibraryStatus.WATCHING, 5, null, 200)))
        assertEquals(1, plan.pull.size)
    }

    @Test fun dirtyLocal_withUnchangedRemote_isPushed() {
        val local = entry(1, progress = 7, remote = 200, dirty = true)
        val plan = SyncPlanner.plan(listOf(local), listOf(RemoteEntry(1, LibraryStatus.WATCHING, 5, null, 200)))
        assertEquals(1, plan.push.size)
        assertTrue(plan.pull.isEmpty())
    }

    @Test fun bothChanged_becomesConflict_neverSilentOverwrite() {
        val local = entry(1, progress = 7, remote = 100, dirty = true)
        val plan = SyncPlanner.plan(listOf(local), listOf(RemoteEntry(1, LibraryStatus.WATCHING, 9, null, 200)))
        assertEquals(1, plan.conflicts.size)
        assertTrue(plan.pull.isEmpty() && plan.push.isEmpty())
        assertTrue(plan.conflicts.first().differences.any { it.contains("Progress") })
    }

    @Test fun identicalValues_areInSync() {
        val plan = SyncPlanner.plan(listOf(entry(1, progress = 5)), listOf(RemoteEntry(1, LibraryStatus.WATCHING, 5, null, 999)))
        assertEquals(listOf(1), plan.alreadyInSync)
        assertTrue(plan.isEmpty)
    }
}

class PartySyncTest {
    private val playing = PartyPlaybackState(isPlaying = true, positionMs = 10_000, rate = 1f, updatedAtServerMs = 100_000, episode = 1)

    @Test fun expectedPosition_advancesOnlyWhilePlaying() {
        assertEquals(15_000, PartySync.expectedPositionMs(playing, 105_000))
        assertEquals(10_000, PartySync.expectedPositionMs(playing.copy(isPlaying = false), 105_000))
        assertEquals(20_000, PartySync.expectedPositionMs(playing.copy(rate = 2f), 105_000))
    }

    @Test fun largeDrift_seeks() {
        val c = PartySync.corrections(localPositionMs = 2_000, localPlaying = true, localEpisode = 1, state = playing, serverNowMs = 105_000)
        assertTrue(c.any { it is SyncCorrection.Seek && it.toMs == 15_000L })
    }

    @Test fun smallDrift_nudgesRate_inTheRightDirection() {
        val ahead = PartySync.corrections(15_600, true, 1, playing, 105_000).filterIsInstance<SyncCorrection.Rate>().first()
        val behind = PartySync.corrections(14_400, true, 1, playing, 105_000).filterIsInstance<SyncCorrection.Rate>().first()
        assertTrue("ahead → slower", ahead.rate < 1f)
        assertTrue("behind → faster", behind.rate > 1f)
        assertTrue(ahead.rate >= 0.92f && behind.rate <= 1.08f)
    }

    @Test fun inSync_restoresRoomRate_andMatchesPlayState() {
        val c = PartySync.corrections(15_050, false, 1, playing, 105_000)
        assertTrue(c.contains(SyncCorrection.Rate(1f)))
        assertTrue(c.contains(SyncCorrection.Play))
        val paused = PartySync.corrections(10_000, true, 1, playing.copy(isPlaying = false), 105_000)
        assertTrue(paused.contains(SyncCorrection.Pause))
    }

    @Test fun episodeMismatch_changesEpisodeFirst() {
        assertEquals(listOf(SyncCorrection.ChangeEpisode(2)), PartySync.corrections(0, false, 1, playing.copy(episode = 2), 105_000))
    }

    @Test fun clockOffset_usesLowestRttSample() {
        val est = ClockOffsetEstimator()
        est.addSample(1_000, 6_100, 1_200)   // rtt 200, offset 5000
        est.addSample(2_000, 7_020, 2_040)   // rtt 40,  offset 5000
        est.addSample(3_000, 9_500, 3_900)   // rtt 900 (asymmetric, ignored)
        assertEquals(5_000L, est.offsetMs)
        assertEquals(15_000L, est.serverNow(10_000))
    }

    @Test fun reactions_areWhitelisted() {
        assertTrue(PartyReactions.isAllowed("🔥"))
        assertFalse(PartyReactions.isAllowed("<script>"))
    }
}

class RecommendationEngineTest {
    private val psych = Anime(id = 10, title = "Monster", genres = listOf("Psychological", "Thriller"), score = 88, popularity = 300_000,
        tags = listOf(AnimeTag("Serial Killer", 90)))
    private val comedy = Anime(id = 11, title = "Gintama", genres = listOf("Comedy"), score = 90, popularity = 300_000)

    @Test fun ranksByTaste_andExplains() {
        val lib = listOf(entry(1, LibraryStatus.COMPLETED, score = 95, genres = listOf("Psychological", "Thriller")))
        val profile = RecommendationEngine.profile(lib)
        val ranked = RecommendationEngine.rank(profile, listOf(comedy, psych), excludeIds = emptySet())
        assertEquals(10, ranked.first().anime.id)
        assertTrue(ranked.first().reason, ranked.first().reason.contains("Psychological"))
    }

    @Test fun excludesOwned_andPenalisesDropped() {
        val lib = listOf(entry(1, LibraryStatus.DROPPED, genres = listOf("Comedy")), entry(10))
        val profile = RecommendationEngine.profile(lib)
        assertTrue((profile.genreWeights["Comedy"] ?: 0.0) < 0)
        val ranked = RecommendationEngine.rank(profile, listOf(psych, comedy), excludeIds = setOf(10))
        assertTrue(ranked.none { it.anime.id == 10 })
    }

    @Test fun likedSeed_producesBecauseYouLiked() {
        val r = RecommendationEngine.score(comedy, RecommendationEngine.profile(emptyList()), likedSeed = "Gintama°")
        assertEquals("Because you liked Gintama°", r.reason)
    }

    @Test fun onboardingGenres_seedEmptyLibrary() {
        val p = RecommendationEngine.profile(emptyList(), setOf("Comedy"))
        assertFalse(p.isEmpty)
        assertEquals("Comedy", p.topGenres.first())
    }
}

class LibraryAndDiscoveryTest {
    @Test fun libraryFilter_statusFavoritesGenreQueryAndSort() {
        val list = listOf(
            entry(1, LibraryStatus.WATCHING, score = 70, title = "Bocchi", updated = 3),
            entry(2, LibraryStatus.COMPLETED, score = 95, fav = true, genres = listOf("Drama"), title = "Anohana", updated = 1),
            entry(3, LibraryStatus.COMPLETED, score = 80, title = "Cowboy Bebop", updated = 2),
        )
        assertEquals(listOf(2, 3), list.applyFilter(LibraryFilter(status = LibraryStatus.COMPLETED, sort = LibrarySort.SCORE)).map { it.animeId })
        assertEquals(listOf(2), list.applyFilter(LibraryFilter(favoritesOnly = true)).map { it.animeId })
        assertEquals(listOf(2), list.applyFilter(LibraryFilter(genre = "Drama")).map { it.animeId })
        assertEquals(listOf(3), list.applyFilter(LibraryFilter(query = "bebop")).map { it.animeId })
        assertEquals(listOf(2, 1, 3), list.applyFilter(LibraryFilter(sort = LibrarySort.TITLE)).map { it.animeId })
        assertEquals(listOf(1, 3, 2), list.applyFilter(LibraryFilter(sort = LibrarySort.RECENT)).map { it.animeId })
    }

    @Test fun searchFilters_countAndEmptiness() {
        assertTrue(SearchFilters().isEmpty)
        val f = SearchFilters(genres = setOf("Action"), excludedGenres = setOf("Horror"), year = 2020, minScore = 70)
        assertFalse(f.isEmpty)
        assertEquals(4, f.activeCount)
    }

    @Test fun seasons_decemberBelongsToNextYearsWinter() {
        assertEquals(AnimeSeason.WINTER to 2027, AnimeSeason.current(12, 2026))
        assertEquals(AnimeSeason.FALL to 2026, AnimeSeason.current(11, 2026))
        assertEquals(AnimeSeason.WINTER to 2027, AnimeSeason.FALL.next(2026))
        assertEquals(AnimeSeason.FALL to 2025, AnimeSeason.WINTER.previous(2026))
    }

    @Test fun moods_mapToExplainableFilters() {
        val f = Mood.RELAXING.toFilters()
        assertTrue("Slice of Life" in f.genres)
        assertTrue("Horror" in f.excludedGenres)
        assertTrue(Mood.RELAXING.toGenreOnlyFilters().tags.isEmpty())
    }

    @Test fun roulette_isRandom_butDeterministicWithSeed() {
        val a = Roulette(Random(1)); val b = Roulette(Random(1))
        val items = (1..30).toList()
        assertEquals(a.pick(items), b.pick(items))
        assertNull(Roulette().pick(emptyList<Int>()))
        val r = Roulette(Random(5)); repeat(50) { assertTrue(r.randomPage(10) in 1..10) }
    }

    @Test fun animeDna_usesRealLibraryData() {
        val dna = AnimeDnaCalculator.compute(listOf(
            entry(1, LibraryStatus.COMPLETED, progress = 12, score = 90, genres = listOf("Psychological"), year = 1998),
            entry(2, LibraryStatus.WATCHING, progress = 6, score = 70, genres = listOf("Psychological", "Mystery"), year = 2019),
            entry(3, LibraryStatus.PLANNING, genres = listOf("Comedy")),
        ))
        assertEquals(3, dna.totalTitles)
        assertEquals(1, dna.completed)
        assertEquals(18, dna.episodesWatched)
        assertEquals(80.0, dna.averageScore!!, 0.001)
        assertEquals("Psychological", dna.genreShare.first().first)
        assertEquals("Mind-Game Strategist", dna.archetype)
        assertEquals(listOf("1990s" to 1, "2010s" to 1, "2020s" to 1), dna.eras)
    }

    @Test fun achievements_unlockFromRealEventsOnly() {
        val lib = (1..10).map { entry(it, LibraryStatus.COMPLETED, score = 80, genres = listOf("G$it")) }
        val unlocked = AchievementCatalog.unlockedIds(AchievementStats(lib, reviewsPosted = 0, partiesHosted = 1, currentSeasonYear = 2023))
        assertTrue("first_complete" in unlocked && "ten_complete" in unlocked && "genre_explorer" in unlocked && "first_party" in unlocked && "critic" in unlocked)
        assertFalse("first_review" in unlocked)
    }

    @Test fun skipMarkers_activeWindow() {
        val markers = listOf(SkipMarker(SkipKind.INTRO, 0, 30_000, "demo"), SkipMarker(SkipKind.CREDITS, 600_000, 700_000, "demo"))
        assertEquals(SkipKind.INTRO, SkipLogic.activeMarker(10_000, markers)?.kind)
        assertNull(SkipLogic.activeMarker(29_500, markers))
        assertNull(SkipLogic.activeMarker(100_000, markers))
        assertEquals(SkipKind.CREDITS, SkipLogic.activeMarker(650_000, markers)?.kind)
    }

    @Test fun accountValidationRules() {
        assertTrue(UsernameRules.isValid("kaze_fan_01"))
        assertFalse(UsernameRules.isValid("no spaces"))
        assertFalse(UsernameRules.isValid("ab"))
        assertTrue(EmailRules.isValid("a@b.co"))
        assertFalse(EmailRules.isValid("not-an-email"))
        assertTrue(PasswordRules.problems("short").isNotEmpty())
        assertTrue(PasswordRules.problems("longerpassword1").isEmpty())
    }
}
