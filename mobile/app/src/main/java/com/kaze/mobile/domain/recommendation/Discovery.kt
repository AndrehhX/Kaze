package com.kaze.mobile.domain.recommendation

import com.kaze.mobile.domain.model.LibraryEntry
import com.kaze.mobile.domain.model.LibraryStatus
import com.kaze.mobile.domain.model.SearchFilters
import com.kaze.mobile.domain.model.SearchSort
import kotlin.random.Random

/** Moods map transparently to AniList genres/tags; the mapping itself is shown to the user. */
enum class Mood(
    val label: String,
    val glyph: String,
    val genres: Set<String>,
    val tags: Set<String>,
    val excluded: Set<String>,
    val explanation: String,
) {
    ROMANTIC("Romantic", "♡", setOf("Romance"), emptySet(), setOf("Horror"), "Romance, sorted by community score, without horror."),
    EMOTIONAL("Emotional", "☔", setOf("Drama"), setOf("Tragedy"), setOf("Ecchi"), "Drama with tragic themes — keep tissues nearby."),
    RELAXING("Relaxing", "☕", setOf("Slice of Life"), setOf("Iyashikei"), setOf("Horror", "Thriller"), "Slice of life and iyashikei (healing) stories."),
    EXCITING("Exciting", "⚡", setOf("Action"), emptySet(), emptySet(), "High-energy action, highest rated first."),
    MYSTERIOUS("Mysterious", "✷", setOf("Mystery"), emptySet(), emptySet(), "Mysteries with twists to unravel."),
    DARK("Dark", "☾", setOf("Psychological"), emptySet(), setOf("Slice of Life"), "Psychological stories with a darker edge."),
    COMFORTING("Comforting", "☀", setOf("Comedy"), setOf("Found Family"), setOf("Horror"), "Warm comedies and found-family stories."),
    EPIC("Epic", "⚔", setOf("Adventure", "Fantasy"), emptySet(), emptySet(), "Grand adventures across fantasy worlds.");

    fun toFilters(): SearchFilters = SearchFilters(genres = genres, tags = tags, excludedGenres = excluded, sort = SearchSort.SCORE_DESC)
    /** Relaxed variant when the tag combination is too narrow. */
    fun toGenreOnlyFilters(): SearchFilters = SearchFilters(genres = genres, excludedGenres = excluded, sort = SearchSort.SCORE_DESC)
}

/** Genuinely random roulette: picks a random page then a random item, honouring filters. */
class Roulette(private val random: Random = Random.Default) {
    fun randomPage(maxPage: Int): Int = random.nextInt(1, maxPage.coerceAtLeast(1) + 1)
    fun <T> pick(items: List<T>): T? = if (items.isEmpty()) null else items[random.nextInt(items.size)]
}

data class AnimeDna(
    val totalTitles: Int,
    val completed: Int,
    val episodesWatched: Int,
    val estimatedHours: Int,          // labelled as an estimate in the UI (24 min/episode)
    val averageScore: Double?,
    val genreShare: List<Pair<String, Float>>,
    val studios: List<Pair<String, Int>>,
    val statusDistribution: Map<LibraryStatus, Int>,
    val eras: List<Pair<String, Int>>,
    val favoriteCount: Int,
    val archetype: String,
)

object AnimeDnaCalculator {
    fun compute(entries: List<LibraryEntry>): AnimeDna {
        val considered = entries.filter { it.status != LibraryStatus.PLANNING }
        val genreCounts = mutableMapOf<String, Float>()
        considered.forEach { e ->
            val w = 1f + (e.userScore ?: 60) / 100f + if (e.isFavorite) 0.5f else 0f
            e.genres.forEach { genreCounts[it] = (genreCounts[it] ?: 0f) + w }
        }
        val genreTotal = genreCounts.values.sum().coerceAtLeast(1f)
        val genreShare = genreCounts.entries.sortedByDescending { it.value }.take(8).map { it.key to it.value / genreTotal }
        val studios = considered.flatMap { it.studios }.groupingBy { it }.eachCount().entries.sortedByDescending { it.value }.take(6).map { it.key to it.value }
        val scored = entries.mapNotNull { it.userScore }
        val eras = entries.mapNotNull { it.seasonYear }.groupingBy { "${it / 10 * 10}s" }.eachCount().entries.sortedBy { it.key }.map { it.key to it.value }
        val episodes = entries.sumOf { it.progress }
        return AnimeDna(
            totalTitles = entries.size,
            completed = entries.count { it.status == LibraryStatus.COMPLETED },
            episodesWatched = episodes,
            estimatedHours = episodes * 24 / 60,
            averageScore = if (scored.isEmpty()) null else scored.average(),
            genreShare = genreShare,
            studios = studios,
            statusDistribution = LibraryStatus.entries.associateWith { s -> entries.count { it.status == s } },
            eras = eras,
            favoriteCount = entries.count { it.isFavorite },
            archetype = archetype(genreShare.map { it.first }),
        )
    }

    fun archetype(topGenres: List<String>): String {
        val top = topGenres.take(2).toSet()
        return when {
            top.isEmpty() -> "New Explorer"
            "Psychological" in top || "Thriller" in top -> "Mind-Game Strategist"
            "Romance" in top -> "Hopeless Romantic"
            "Slice of Life" in top -> "Cozy Wanderer"
            "Action" in top && "Adventure" in top -> "Shonen Spirit"
            "Fantasy" in top -> "World Walker"
            "Sci-Fi" in top || "Mecha" in top -> "Future Pilot"
            "Comedy" in top -> "Comic Relief"
            "Mystery" in top -> "Midnight Detective"
            "Sports" in top -> "Team Captain"
            "Horror" in top || "Supernatural" in top -> "Spirit Seer"
            else -> "${top.first()} Enthusiast"
        }
    }
}
