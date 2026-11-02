package com.kaze.mobile.domain.recommendation

import com.kaze.mobile.domain.model.Anime
import com.kaze.mobile.domain.model.LibraryEntry
import com.kaze.mobile.domain.model.LibraryStatus
import kotlin.math.ln
import kotlin.math.max

/**
 * Explainable, heuristic recommendation scoring. This is deliberately NOT machine learning:
 * every point a candidate earns comes from a named factor that can be shown to the user.
 */
data class TasteProfile(
    val genreWeights: Map<String, Double>,
    val tagWeights: Map<String, Double>,
    val studioWeights: Map<String, Double>,
    val seedTitles: List<LibraryEntry>,      // titles the user clearly liked
) {
    val topGenres: List<String> get() = genreWeights.entries.filter { it.value > 0 }.sortedByDescending { it.value }.map { it.key }
    val isEmpty: Boolean get() = genreWeights.isEmpty() && tagWeights.isEmpty()
}

data class Recommended(
    val anime: Anime,
    val score: Double,
    val reason: String,
    val factors: List<String>,
)

object RecommendationEngine {

    private fun entryWeight(e: LibraryEntry): Double {
        val scorePart = e.userScore?.let { (it - 55) / 45.0 } ?: 0.25
        val statusPart = when (e.status) {
            LibraryStatus.COMPLETED -> 0.5
            LibraryStatus.REWATCHING -> 0.8
            LibraryStatus.WATCHING -> 0.4
            LibraryStatus.PLANNING -> 0.15
            LibraryStatus.PAUSED -> 0.05
            LibraryStatus.DROPPED -> -0.7
        }
        return scorePart + statusPart + if (e.isFavorite) 0.6 else 0.0
    }

    fun profile(library: List<LibraryEntry>, onboardingGenres: Set<String> = emptySet()): TasteProfile {
        val genres = mutableMapOf<String, Double>()
        val tags = mutableMapOf<String, Double>()
        val studios = mutableMapOf<String, Double>()
        library.forEach { e ->
            val w = entryWeight(e)
            e.genres.forEach { genres[it] = (genres[it] ?: 0.0) + w }
            e.tags.take(8).forEach { tags[it] = (tags[it] ?: 0.0) + w * 0.5 }
            e.studios.forEach { studios[it] = (studios[it] ?: 0.0) + w * 0.4 }
        }
        onboardingGenres.forEach { genres[it] = (genres[it] ?: 0.0) + 0.8 }
        val seeds = library
            .filter { it.status != LibraryStatus.DROPPED && (it.isFavorite || (it.userScore ?: 0) >= 75 || it.status == LibraryStatus.COMPLETED) }
            .sortedWith(compareByDescending<LibraryEntry> { it.isFavorite }.thenByDescending { it.userScore ?: 0 }.thenByDescending { it.updatedAt })
            .take(5)
        return TasteProfile(genres, tags, studios, seeds)
    }

    /**
     * @param anilistRecs candidates AniList users recommended for a seed title, keyed by candidate id
     *                    with the seed title's name (gives "Because you liked X").
     */
    fun rank(
        profile: TasteProfile,
        candidates: List<Anime>,
        excludeIds: Set<Int>,
        anilistRecs: Map<Int, String> = emptyMap(),
        limit: Int = 20,
    ): List<Recommended> {
        val maxGenre = max(1.0, profile.genreWeights.values.maxOrNull() ?: 1.0)
        val maxTag = max(1.0, profile.tagWeights.values.maxOrNull() ?: 1.0)
        return candidates
            .asSequence()
            .distinctBy { it.id }
            .filter { it.id !in excludeIds && !it.isAdult }
            .map { a -> score(a, profile, maxGenre, maxTag, anilistRecs[a.id]) }
            .sortedByDescending { it.score }
            .take(limit)
            .toList()
    }

    fun score(a: Anime, p: TasteProfile, maxGenre: Double = 1.0, maxTag: Double = 1.0, likedSeed: String? = null): Recommended {
        val factors = mutableListOf<Pair<Double, String>>()
        val matchedGenres = a.genres.filter { (p.genreWeights[it] ?: 0.0) > 0 }
            .sortedByDescending { p.genreWeights[it] }
        val genreScore = a.genres.sumOf { (p.genreWeights[it] ?: 0.0) / maxGenre } / max(1, a.genres.size).toDouble() * 2.0
        if (matchedGenres.isNotEmpty()) factors += genreScore to "you enjoy ${matchedGenres.take(2).joinToString(" and ")}"

        val matchedTags = a.tags.filter { !it.isSpoiler && (p.tagWeights[it.name] ?: 0.0) > 0 }
        val tagScore = matchedTags.sumOf { (p.tagWeights[it.name] ?: 0.0) / maxTag * (it.rank / 100.0) } * 0.8
        if (matchedTags.isNotEmpty()) factors += tagScore to "it shares themes like ${matchedTags.first().name.lowercase()}"

        val studioScore = a.studios.sumOf { p.studioWeights[it] ?: 0.0 }.coerceAtMost(1.0) * 0.4
        if (studioScore > 0.05) factors += studioScore to "it's from ${a.studios.first()}, a studio you like"

        val community = ((a.score ?: 60) - 60) / 40.0 * 0.7
        if ((a.score ?: 0) >= 80) factors += community to "the community rates it ${a.score}%"

        val popularity = a.popularity?.let { ln(1.0 + it) / ln(1_000_000.0) * 0.3 } ?: 0.0
        val seedBoost = if (likedSeed != null) 1.1 else 0.0
        if (likedSeed != null) factors += seedBoost to "you liked $likedSeed"

        val total = genreScore + tagScore + studioScore + community + popularity + seedBoost
        val top = factors.sortedByDescending { it.first }
        val reason = when {
            top.isEmpty() -> "Popular with the AniList community"
            top.first().second.startsWith("you liked") -> "Because ${top.first().second}"
            else -> "Recommended because ${top.first().second}"
        }
        return Recommended(a, total, reason, top.map { it.second })
    }
}
