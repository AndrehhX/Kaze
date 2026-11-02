package com.kaze.mobile.data.library

import com.kaze.mobile.core.database.AchievementEntity
import com.kaze.mobile.core.database.ActivityDao
import com.kaze.mobile.core.database.ActivityEventEntity
import com.kaze.mobile.data.anilist.Clock
import com.kaze.mobile.domain.achievements.AchievementCatalog
import com.kaze.mobile.domain.achievements.AchievementDef
import com.kaze.mobile.domain.achievements.AchievementStats
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import java.time.LocalDate
import javax.inject.Inject
import javax.inject.Singleton

data class AchievementProgress(val def: AchievementDef, val progress: Int, val unlockedAt: Long?)

@Singleton
class AchievementsRepository @Inject constructor(
    private val library: LibraryRepository,
    private val activity: ActivityDao,
    private val clock: Clock,
) {
    val recentActivity: Flow<List<ActivityEventEntity>> = activity.observeRecent()

    /** Evaluates achievements from real local events and records first-unlock timestamps. */
    val achievements: Flow<List<AchievementProgress>> =
        combine(library.entries, activity.observeAchievements(), activity.observeRecent(500)) { lib, unlocked, events ->
            val stats = AchievementStats(
                library = lib,
                reviewsPosted = events.count { it.type == ActivityTypes.REVIEW_POSTED },
                partiesHosted = events.count { it.type == ActivityTypes.PARTY_HOSTED },
                currentSeasonYear = LocalDate.now().year,
            )
            val unlockedMap = unlocked.associate { it.id to it.unlockedAt }
            AchievementCatalog.evaluate(stats).map { (def, p) ->
                val at = unlockedMap[def.id] ?: if (p >= def.target) clock.nowMillis().also { activity.unlock(AchievementEntity(def.id, it)) } else null
                AchievementProgress(def, p, at)
            }
        }

    val unlockedCount: Flow<Int> = achievements.map { list -> list.count { it.unlockedAt != null } }
}
