package com.kaze.mobile.domain.achievements

import com.kaze.mobile.domain.model.LibraryEntry
import com.kaze.mobile.domain.model.LibraryStatus

/** Facts gathered from real local events; achievements never fire from anything else. */
data class AchievementStats(
    val library: List<LibraryEntry>,
    val reviewsPosted: Int,
    val partiesHosted: Int,
    val currentSeasonYear: Int,
)

data class AchievementDef(
    val id: String,
    val title: String,
    val description: String,
    val glyph: String,
    val target: Int,
    val progress: (AchievementStats) -> Int,
)

object AchievementCatalog {
    private fun completed(s: AchievementStats) = s.library.count { it.status == LibraryStatus.COMPLETED }

    val all = listOf(
        AchievementDef("first_complete", "First Arc", "Complete your first anime.", "★", 1) { completed(it) },
        AchievementDef("ten_complete", "Seasoned Viewer", "Complete ten anime.", "✦", 10) { completed(it) },
        AchievementDef("genre_explorer", "Genre Explorer", "Complete anime across 8 different genres.", "❀", 8) { s ->
            s.library.filter { it.status == LibraryStatus.COMPLETED }.flatMap { it.genres }.toSet().size
        },
        AchievementDef("seasonal", "Seasonal Challenge", "Watch 5 anime from this year's seasons.", "✿", 5) { s ->
            s.library.count { it.seasonYear == s.currentSeasonYear && it.status in setOf(LibraryStatus.WATCHING, LibraryStatus.COMPLETED) }
        },
        AchievementDef("critic", "Critic's Eye", "Rate ten anime.", "✎", 10) { s -> s.library.count { it.userScore != null } },
        AchievementDef("first_review", "First Review", "Publish your first community review.", "❝", 1) { it.reviewsPosted },
        AchievementDef("first_party", "Party Host", "Host your first watch party.", "♫", 1) { it.partiesHosted },
        AchievementDef("curator", "Curator", "Favourite five anime.", "♡", 5) { s -> s.library.count { it.isFavorite } },
    )

    fun evaluate(stats: AchievementStats): List<Pair<AchievementDef, Int>> = all.map { it to it.progress(stats).coerceAtMost(it.target) }

    fun unlockedIds(stats: AchievementStats): Set<String> = evaluate(stats).filter { (d, p) -> p >= d.target }.map { it.first.id }.toSet()
}
