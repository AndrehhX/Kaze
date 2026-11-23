package com.kaze.mobile.data.backend

import android.content.Context
import com.kaze.mobile.core.common.KazeError
import com.kaze.mobile.core.common.KazeException
import com.kaze.mobile.core.common.Outcome
import com.kaze.mobile.core.common.outcomeOf
import com.kaze.mobile.data.anilist.AniListRepository
import com.kaze.mobile.data.library.LibraryRepository
import com.kaze.mobile.data.library.ProgressRepository
import com.kaze.mobile.domain.model.LibraryEntry
import com.kaze.mobile.domain.model.LibraryStatus
import com.kaze.mobile.domain.social.MediaSnap
import com.kaze.mobile.domain.sync.ConflictChoice
import com.kaze.mobile.domain.sync.RemoteEntry
import com.kaze.mobile.domain.sync.SyncPlan
import com.kaze.mobile.domain.sync.SyncPlanner
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

/** Fila de `anime_library_entries`: la misma tabla que usa la biblioteca de KAZE Web. */
@Serializable
private data class CloudEntry(
    @SerialName("media_id") val animeId: Int,
    val status: String,
    val progress: Int = 0,
    val score: Int? = null,
    val favorite: Boolean = false,
    @SerialName("updated_at") val updatedAt: String,
    @SerialName("media_snapshot") val media: MediaSnap? = null,
)

/** Fila de `watch_progress` (progreso de cada episodio, compartido con el reproductor web). */
@Serializable
private data class CloudProgress(
    @SerialName("series_id") val seriesId: String,
    @SerialName("episode_id") val episodeId: String,
    @SerialName("position_seconds") val positionSeconds: Double = 0.0,
    @SerialName("duration_seconds") val durationSeconds: Double = 0.0,
    val completed: Boolean = false,
    @SerialName("updated_at") val updatedAt: String,
)

private const val LIBRARY_COLS = "media_id,status,progress,score,favorite,updated_at,media_snapshot"
private const val PROGRESS_COLS = "series_id,episode_id,position_seconds,duration_seconds,completed,updated_at"

private fun LibraryStatus.toWeb(): String = anilist
private fun webStatus(value: String): LibraryStatus = LibraryStatus.fromAniList(value) ?: LibraryStatus.fromName(value)

/**
 * Sincroniza la biblioteca y el progreso del teléfono con las tablas de KAZE Web.
 * Lo que marcas o ves en la app aparece en la web y al revés.
 */
@Singleton
class CloudLibraryRepository @Inject constructor(
    private val sb: SupabaseClient,
    private val library: LibraryRepository,
    private val progress: ProgressRepository,
    private val anilist: AniListRepository,
    private val json: Json,
    @ApplicationContext context: Context,
) {
    private val prefs = context.getSharedPreferences("kaze_cloud_sync", Context.MODE_PRIVATE)
    private val mutex = Mutex()

    private suspend fun fetchRemote(me: String): List<CloudEntry> =
        sb.select("anime_library_entries", "user_id=eq.$me&select=$LIBRARY_COLS&limit=5000", ListSerializer(CloudEntry.serializer()))

    private fun CloudEntry.toRemote() = RemoteEntry(animeId, webStatus(status), progress, score, parseIsoMillis(updatedAt) / 1000, favorite)

    // ---------------------------------------------------------------- pantalla manual (con conflictos)
    suspend fun preview(): Outcome<SyncPlan> = outcomeOf {
        val me = sb.currentUserId ?: throw KazeException(KazeError.Unauthorized)
        SyncPlanner.plan(library.snapshot(), fetchRemote(me).map { it.toRemote() })
    }

    suspend fun apply(plan: SyncPlan, choices: Map<Int, ConflictChoice>): Outcome<Pair<Int, Int>> = outcomeOf {
        val me = sb.currentUserId ?: throw KazeException(KazeError.Unauthorized)
        val snaps = fetchRemote(me).associate { it.animeId to (it.media ?: MediaSnap()) }
        library.applyRemote(plan.pull, emptyMap(), snaps)
        val toPush = plan.push.toMutableList()
        plan.conflicts.forEach { c ->
            when (choices[c.local.animeId]) {
                ConflictChoice.USE_REMOTE -> library.applyRemote(listOf(c.remote), emptyMap(), snaps)
                ConflictChoice.KEEP_LOCAL -> { library.resolveConflict(c, ConflictChoice.KEEP_LOCAL, null); toPush += c.local }
                null -> Unit
            }
        }
        push(me, toPush)
        plan.pull.size to toPush.size
    }

    // ---------------------------------------------------------------- sincronización automática
    data class SyncResult(val pulled: Int, val pushed: Int, val deleted: Int, val progressPulled: Int, val progressPushed: Int)

    /**
     * Sincroniza todo sin preguntar. Si un anime cambió en los dos lados, gana el cambio más
     * reciente (igual que hace la web). Se ejecuta al abrir la app, al iniciar sesión y tras cambios.
     */
    suspend fun syncAll(): Outcome<SyncResult> = mutex.withLock {
        outcomeOf {
            val me = sb.currentUserId ?: throw KazeException(KazeError.Unauthorized)
            if (prefs.getString(KEY_USER, null) != me) {
                // Otra cuenta en este teléfono: empezar de cero el registro de sincronización.
                prefs.edit().clear().putString(KEY_USER, me).apply()
            }
            val lib = syncLibrary(me)
            val (pPull, pPush) = syncProgress(me)
            SyncResult(lib.first, lib.second, lib.third, pPull, pPush)
        }
    }

    private suspend fun syncLibrary(me: String): Triple<Int, Int, Int> {
        val remoteRows = fetchRemote(me)
        val snaps = remoteRows.associate { it.animeId to (it.media ?: MediaSnap()) }
        val remote = remoteRows.map { it.toRemote() }
        val remoteIds = remote.map { it.animeId }.toSet()
        val local = library.snapshot()
        val localIds = local.map { it.animeId }.toSet()
        val known = prefs.getStringSet(KEY_KNOWN, emptySet()).orEmpty().mapNotNull { it.toIntOrNull() }.toSet()

        // Borrados: lo que estaba sincronizado y ya no existe en un lado se borra en el otro.
        val deletedHere = remoteIds.filter { it in known && it !in localIds }
        val deletedThere = local.filter { it.animeId in known && it.animeId !in remoteIds && !it.dirty }.map { it.animeId }
        if (deletedHere.isNotEmpty()) {
            sb.delete("anime_library_entries", "user_id=eq.$me&media_id=in.(${deletedHere.joinToString(",")})")
        }
        if (deletedThere.isNotEmpty()) library.remove(deletedThere)

        val plan = SyncPlanner.plan(
            library.snapshot(),
            remote.filter { it.animeId !in deletedHere },
        )
        val pull = plan.pull.toMutableList()
        val push = plan.push.toMutableList()
        plan.conflicts.forEach { c ->
            val remoteMs = c.remote.updatedAt * 1000
            if (remoteMs > c.local.updatedAt) pull += c.remote
            else { library.resolveConflict(c, ConflictChoice.KEEP_LOCAL, null); push += c.local }
        }
        if (pull.isNotEmpty()) library.applyRemote(pull, emptyMap(), snaps)
        push(me, push)

        val nowKnown = (library.snapshot().map { it.animeId }.toSet()).map { it.toString() }.toSet()
        prefs.edit().putStringSet(KEY_KNOWN, nowKnown).apply()
        return Triple(pull.size, push.size, deletedHere.size + deletedThere.size)
    }

    private suspend fun push(me: String, entries: List<LibraryEntry>) {
        if (entries.isEmpty()) return
        entries.chunked(100).forEach { chunk ->
            val body = "[" + chunk.joinToString(",") { e ->
                mapOf(
                    "user_id" to me,
                    "media_id" to e.animeId,
                    "status" to e.status.toWeb(),
                    "progress" to e.progress.coerceIn(0, 10000),
                    "score" to e.userScore?.takeIf { it in 1..100 },
                    "favorite" to e.isFavorite,
                    "repeat" to e.rewatchCount.coerceAtLeast(0),
                    "media_snapshot" to mapOf(
                        "title" to e.title, "cover" to e.coverUrl, "banner" to e.bannerUrl, "color" to e.color,
                        "format" to e.format, "genres" to e.genres, "episodes" to e.totalEpisodes, "year" to e.seasonYear,
                        "averageScore" to e.communityScore, "studio" to e.studios.firstOrNull(),
                    ),
                    "updated_at" to Instant.ofEpochMilli(e.updatedAt).toString(),
                ).toJsonBody()
            } + "]"
            val res = sb.insert("anime_library_entries?on_conflict=user_id,media_id&select=$LIBRARY_COLS", body, returning = true, upsert = true)
            json.decodeFromString(ListSerializer(CloudEntry.serializer()), res).forEach { library.markPushed(it.animeId, parseIsoMillis(it.updatedAt) / 1000) }
        }
    }

    private suspend fun syncProgress(me: String): Pair<Int, Int> {
        // Bajar: lo visto en la web (o en otro teléfono) aparece en "Seguir viendo".
        val rows = sb.select("watch_progress", "user_id=eq.$me&select=$PROGRESS_COLS&order=updated_at.desc&limit=300", ListSerializer(CloudProgress.serializer()))
        val entries = library.snapshot().associateBy { it.animeId }
        val parsed = rows.mapNotNull { r ->
            val id = r.seriesId.toIntOrNull() ?: return@mapNotNull null
            val ep = r.episodeId.toIntOrNull() ?: return@mapNotNull null
            if (r.durationSeconds <= 0) return@mapNotNull null
            Triple(id, ep, r)
        }
        val missing = parsed.map { it.first }.distinct().filter { it !in entries }.take(50)
        val meta = if (missing.isEmpty()) emptyMap() else (anilist.byIds(missing) as? Outcome.Success)?.value.orEmpty().associateBy { it.id }
        var pulled = 0
        parsed.forEach { (id, ep, r) ->
            val e = entries[id]
            val a = meta[id]
            val applied = progress.applyRemote(
                animeId = id, episode = ep,
                title = e?.title ?: a?.displayTitle ?: "Anime #$id",
                cover = e?.coverUrl ?: a?.coverUrl, banner = e?.bannerUrl ?: a?.bannerUrl,
                positionMs = (r.positionSeconds * 1000).toLong(), durationMs = (r.durationSeconds * 1000).toLong(),
                completed = r.completed, updatedAtMs = parseIsoMillis(r.updatedAt),
            )
            if (applied) pulled++
        }

        // Subir: lo visto en el teléfono desde la última vez.
        val since = prefs.getLong(KEY_PROGRESS_WATERMARK, 0L)
        val changed = progress.changedSince(since)
        if (changed.isNotEmpty()) {
            val body = "[" + changed.joinToString(",") { p ->
                mapOf(
                    "user_id" to me,
                    "series_id" to p.animeId.toString(),
                    "episode_id" to p.episode.toString(),
                    "position_seconds" to p.positionMs / 1000.0,
                    "duration_seconds" to p.durationMs / 1000.0,
                    "completed" to p.completed,
                    "updated_at" to Instant.ofEpochMilli(p.updatedAt).toString(),
                ).toJsonBody()
            } + "]"
            sb.insert("watch_progress?on_conflict=user_id,series_id,episode_id", body, returning = false, upsert = true)
            prefs.edit().putLong(KEY_PROGRESS_WATERMARK, changed.maxOf { it.updatedAt }).apply()
        }
        return pulled to changed.size
    }

    private companion object {
        const val KEY_USER = "user"
        const val KEY_KNOWN = "known_library_ids"
        const val KEY_PROGRESS_WATERMARK = "progress_watermark"
    }
}
