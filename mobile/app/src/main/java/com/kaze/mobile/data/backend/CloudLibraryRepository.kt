package com.kaze.mobile.data.backend

import com.kaze.mobile.core.common.KazeError
import com.kaze.mobile.core.common.KazeException
import com.kaze.mobile.core.common.Outcome
import com.kaze.mobile.core.common.outcomeOf
import com.kaze.mobile.data.anilist.AniListRepository
import com.kaze.mobile.data.library.LibraryRepository
import com.kaze.mobile.domain.model.LibraryStatus
import com.kaze.mobile.domain.sync.ConflictChoice
import com.kaze.mobile.domain.sync.RemoteEntry
import com.kaze.mobile.domain.sync.SyncPlan
import com.kaze.mobile.domain.sync.SyncPlanner
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

@Serializable
private data class CloudEntry(
    @SerialName("anime_id") val animeId: Int,
    val status: String,
    val progress: Int = 0,
    val score: Int? = null,
    @SerialName("is_favorite") val isFavorite: Boolean = false,
    @SerialName("updated_at") val updatedAt: String,
)

/**
 * Mirrors the on-device library to the shared `library_entries` table (same table KAZE Web
 * can read), using the same conflict-safe planner as AniList sync.
 */
@Singleton
class CloudLibraryRepository @Inject constructor(
    private val sb: SupabaseClient,
    private val library: LibraryRepository,
    private val anilist: AniListRepository,
    private val json: Json,
) {
    suspend fun preview(): Outcome<SyncPlan> = outcomeOf {
        val me = sb.currentUserId ?: throw KazeException(KazeError.Unauthorized)
        val rows = sb.select("library_entries", "user_id=eq.$me&select=anime_id,status,progress,score,is_favorite,updated_at", ListSerializer(CloudEntry.serializer()))
        val remote = rows.map { RemoteEntry(it.animeId, LibraryStatus.fromName(it.status), it.progress, it.score, parseIsoMillis(it.updatedAt) / 1000, it.isFavorite) }
        SyncPlanner.plan(library.snapshot(), remote)
    }

    suspend fun apply(plan: SyncPlan, choices: Map<Int, ConflictChoice>): Outcome<Pair<Int, Int>> = outcomeOf {
        val me = sb.currentUserId ?: throw KazeException(KazeError.Unauthorized)
        val missing = plan.pull.map { it.animeId }
        val metadata = (anilist.byIds(missing) as? Outcome.Success)?.value.orEmpty().associateBy { it.id }
        library.applyRemote(plan.pull, metadata)
        val toPush = plan.push.toMutableList()
        plan.conflicts.forEach { c ->
            when (choices[c.local.animeId]) {
                ConflictChoice.USE_REMOTE -> library.resolveConflict(c, ConflictChoice.USE_REMOTE, metadata[c.local.animeId])
                ConflictChoice.KEEP_LOCAL -> { library.resolveConflict(c, ConflictChoice.KEEP_LOCAL, null); toPush += c.local }
                null -> Unit
            }
        }
        if (toPush.isNotEmpty()) {
            val body = "[" + toPush.joinToString(",") { e ->
                mapOf("user_id" to me, "anime_id" to e.animeId, "status" to e.status.name, "progress" to e.progress, "score" to e.userScore,
                    "is_favorite" to e.isFavorite, "title" to e.title, "cover_url" to e.coverUrl).toJsonBody()
            } + "]"
            val res = sb.insert("library_entries?on_conflict=user_id,anime_id", body, returning = true, upsert = true)
            json.decodeFromString(ListSerializer(CloudEntry.serializer()), res).forEach { library.markPushed(it.animeId, parseIsoMillis(it.updatedAt) / 1000) }
        }
        plan.pull.size to toPush.size
    }
}
