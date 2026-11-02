package com.kaze.mobile.data.library

import androidx.room.withTransaction
import com.kaze.mobile.core.database.ActivityDao
import com.kaze.mobile.core.database.ActivityEventEntity
import com.kaze.mobile.core.database.CollectionDao
import com.kaze.mobile.core.database.CollectionEntity
import com.kaze.mobile.core.database.CollectionItemEntity
import com.kaze.mobile.core.database.KazeDatabase
import com.kaze.mobile.core.database.LibraryDao
import com.kaze.mobile.core.database.LibraryEntryEntity
import com.kaze.mobile.core.database.PlaybackDao
import com.kaze.mobile.core.database.PlaybackProgressEntity
import com.kaze.mobile.data.anilist.Clock
import com.kaze.mobile.domain.model.Anime
import com.kaze.mobile.domain.model.AnimeCollection
import com.kaze.mobile.domain.model.CollectionItem
import com.kaze.mobile.domain.model.ExportedCollection
import com.kaze.mobile.domain.model.LibraryEntry
import com.kaze.mobile.domain.model.LibraryExport
import com.kaze.mobile.domain.model.LibraryStatus
import com.kaze.mobile.domain.model.WatchProgress
import com.kaze.mobile.domain.sync.ConflictChoice
import com.kaze.mobile.domain.sync.RemoteEntry
import com.kaze.mobile.domain.sync.SyncConflict
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

object ActivityTypes {
    const val ADDED = "added"
    const val COMPLETED = "completed"
    const val PROGRESS = "progress"
    const val RATED = "rated"
    const val REVIEW_POSTED = "review_posted"
    const val PARTY_HOSTED = "party_hosted"
    const val FAVORITED = "favorited"
}

fun LibraryEntryEntity.toDomain() = LibraryEntry(
    animeId, title, coverUrl, bannerUrl, color, genres, tags, studios, format, totalEpisodes, communityScore, popularity, seasonYear,
    LibraryStatus.fromName(status), progress, userScore, isFavorite, rewatchCount, notes, addedAt, updatedAt, startedAt, completedAt,
    sortOrder, remoteUpdatedAt, dirty,
)

fun LibraryEntry.toEntity() = LibraryEntryEntity(
    animeId, title, coverUrl, bannerUrl, color, genres, tags, studios, format, totalEpisodes, communityScore, popularity, seasonYear,
    status.name, progress, userScore, isFavorite, rewatchCount, notes, addedAt, updatedAt, startedAt, completedAt, sortOrder, remoteUpdatedAt, dirty,
)

@Singleton
class LibraryRepository @Inject constructor(
    private val db: KazeDatabase,
    private val dao: LibraryDao,
    private val collections: CollectionDao,
    private val activity: ActivityDao,
    private val clock: Clock,
    private val json: Json,
) {
    val entries: Flow<List<LibraryEntry>> = dao.observeAll().map { list -> list.map { it.toDomain() } }

    fun entry(animeId: Int): Flow<LibraryEntry?> = dao.observe(animeId).map { it?.toDomain() }

    suspend fun snapshot(): List<LibraryEntry> = dao.getAll().map { it.toDomain() }

    suspend fun addOrUpdate(anime: Anime, status: LibraryStatus) {
        val now = clock.nowMillis()
        val existing = dao.get(anime.id)?.toDomain()
        val base = existing ?: LibraryEntry(animeId = anime.id, title = anime.displayTitle, addedAt = now)
        val updated = base.copy(
            title = anime.displayTitle,
            coverUrl = anime.coverUrl, bannerUrl = anime.bannerUrl, color = anime.color,
            genres = anime.genres, tags = anime.tags.filterNot { it.isSpoiler }.sortedByDescending { it.rank }.take(12).map { it.name },
            studios = anime.studios, format = anime.format, totalEpisodes = anime.episodes,
            communityScore = anime.score, popularity = anime.popularity, seasonYear = anime.seasonYear ?: anime.startYear,
        )
        save(applyStatus(updated, status, now))
        if (existing == null) log(ActivityTypes.ADDED, anime.id, anime.displayTitle, status.label)
    }

    suspend fun setStatus(animeId: Int, status: LibraryStatus) {
        val e = dao.get(animeId)?.toDomain() ?: return
        save(applyStatus(e, status, clock.nowMillis()))
    }

    suspend fun bulkSetStatus(ids: Collection<Int>, status: LibraryStatus) = db.withTransaction {
        ids.forEach { setStatus(it, status) }
    }

    private suspend fun applyStatus(e: LibraryEntry, status: LibraryStatus, now: Long): LibraryEntry {
        var next = e.copy(status = status)
        if (status == LibraryStatus.WATCHING && e.startedAt == null) next = next.copy(startedAt = now)
        if (status == LibraryStatus.COMPLETED && e.status != LibraryStatus.COMPLETED) {
            next = next.copy(completedAt = now, progress = e.totalEpisodes ?: e.progress)
            log(ActivityTypes.COMPLETED, e.animeId, e.title, null)
        }
        if (status == LibraryStatus.REWATCHING && e.status == LibraryStatus.COMPLETED) next = next.copy(progress = 0, rewatchCount = e.rewatchCount + 1)
        return next
    }

    /** Returns true when this update completed the series (drives the celebration animation). */
    suspend fun setProgress(animeId: Int, progress: Int): Boolean {
        val e = dao.get(animeId)?.toDomain() ?: return false
        val total = e.totalEpisodes
        val p = progress.coerceAtLeast(0).let { if (total != null && total > 0) it.coerceAtMost(total) else it }
        var next = e.copy(progress = p)
        var completed = false
        if (total != null && total > 0 && p >= total && e.status != LibraryStatus.COMPLETED) {
            next = applyStatus(next, LibraryStatus.COMPLETED, clock.nowMillis())
            completed = true
        } else if (p > 0 && e.status == LibraryStatus.PLANNING) {
            next = applyStatus(next, LibraryStatus.WATCHING, clock.nowMillis())
        }
        save(next)
        if (!completed && p > e.progress) log(ActivityTypes.PROGRESS, animeId, e.title, "Episode $p")
        return completed
    }

    suspend fun setScore(animeId: Int, score: Int?) {
        val e = dao.get(animeId)?.toDomain() ?: return
        save(e.copy(userScore = score?.coerceIn(0, 100)))
        if (score != null) log(ActivityTypes.RATED, animeId, e.title, "$score/100")
    }

    suspend fun setNotes(animeId: Int, notes: String) {
        val e = dao.get(animeId)?.toDomain() ?: return
        save(e.copy(notes = notes.take(2000)))
    }

    suspend fun toggleFavorite(anime: Anime) {
        val e = dao.get(anime.id)
        if (e == null) {
            addOrUpdate(anime, LibraryStatus.PLANNING)
        }
        val current = dao.get(anime.id)!!.toDomain()
        save(current.copy(isFavorite = !current.isFavorite))
        if (!current.isFavorite) log(ActivityTypes.FAVORITED, anime.id, anime.displayTitle, null)
    }

    suspend fun remove(ids: Collection<Int>) = dao.delete(ids.toList())

    suspend fun reorder(orderedIds: List<Int>) = db.withTransaction {
        orderedIds.forEachIndexed { index, id -> dao.get(id)?.let { dao.upsert(it.copy(sortOrder = index)) } }
    }

    private suspend fun save(e: LibraryEntry) = dao.upsert(e.copy(updatedAt = clock.nowMillis(), dirty = true).toEntity())

    private suspend fun log(type: String, animeId: Int?, title: String?, detail: String?) =
        activity.insert(ActivityEventEntity(type = type, animeId = animeId, title = title, detail = detail, createdAt = clock.nowMillis()))

    suspend fun logEvent(type: String, animeId: Int? = null, title: String? = null, detail: String? = null) = log(type, animeId, title, detail)

    // ---------------- Sync application (never silent overwrites) ----------------

    /** Applies remote values for entries the planner marked as safe to pull. */
    suspend fun applyRemote(remote: List<RemoteEntry>, metadata: Map<Int, Anime>) = db.withTransaction {
        val now = clock.nowMillis()
        remote.forEach { r ->
            val existing = dao.get(r.animeId)?.toDomain()
            val anime = metadata[r.animeId]
            val base = existing ?: LibraryEntry(
                animeId = r.animeId, title = anime?.displayTitle ?: "Anime #${r.animeId}", addedAt = now,
                coverUrl = anime?.coverUrl, bannerUrl = anime?.bannerUrl, color = anime?.color, genres = anime?.genres.orEmpty(),
                tags = anime?.tags.orEmpty().take(12).map { it.name }, studios = anime?.studios.orEmpty(), format = anime?.format,
                totalEpisodes = anime?.episodes, communityScore = anime?.score, popularity = anime?.popularity, seasonYear = anime?.seasonYear,
            )
            dao.upsert(
                base.copy(
                    status = r.status, progress = r.progress, userScore = r.score,
                    isFavorite = base.isFavorite || r.isFavorite,
                    completedAt = if (r.status == LibraryStatus.COMPLETED) base.completedAt ?: now else base.completedAt,
                    updatedAt = now, remoteUpdatedAt = r.updatedAt, dirty = false,
                ).toEntity()
            )
        }
    }

    suspend fun markPushed(animeId: Int, remoteUpdatedAt: Long) = dao.markSynced(animeId, remoteUpdatedAt)

    suspend fun resolveConflict(conflict: SyncConflict, choice: ConflictChoice, anime: Anime?) {
        when (choice) {
            ConflictChoice.USE_REMOTE -> applyRemote(listOf(conflict.remote), anime?.let { mapOf(it.id to it) } ?: emptyMap())
            // Keep local: stays dirty but is now based on the latest remote version, so the next push wins cleanly.
            ConflictChoice.KEEP_LOCAL -> dao.get(conflict.local.animeId)?.let {
                dao.upsert(it.copy(remoteUpdatedAt = conflict.remote.updatedAt, dirty = true))
            }
        }
    }

    // ---------------- Import / export ----------------

    suspend fun exportJson(): String {
        val cols = collections.allCollections()
        val items = collections.allItems().groupBy { it.collectionId }
        val export = LibraryExport(
            exportedAt = clock.nowMillis(),
            entries = snapshot(),
            collections = cols.map { c ->
                val list = items[c.id].orEmpty().sortedBy { it.position }
                ExportedCollection(c.name, c.description, c.isPublic, list.map { it.animeId }, list.map { it.title })
            },
        )
        return json.encodeToString(LibraryExport.serializer(), export)
    }

    data class ImportReport(val added: Int, val updated: Int, val skippedOlder: Int, val collections: Int)

    /** Merge import: an imported entry only replaces a local one if it is newer. */
    suspend fun importJson(text: String): ImportReport {
        val export = json.decodeFromString(LibraryExport.serializer(), text)
        require(export.format == "kaze-library") { "Not a KAZE library export" }
        var added = 0; var updated = 0; var skipped = 0
        db.withTransaction {
            export.entries.forEach { incoming ->
                val local = dao.get(incoming.animeId)
                when {
                    local == null -> { dao.upsert(incoming.copy(dirty = true).toEntity()); added++ }
                    incoming.updatedAt > local.updatedAt -> { dao.upsert(incoming.copy(dirty = true, remoteUpdatedAt = local.remoteUpdatedAt).toEntity()); updated++ }
                    else -> skipped++
                }
            }
            export.collections.forEach { c ->
                val id = collections.insertCollection(CollectionEntity(name = c.name, description = c.description, position = collections.maxCollectionPosition() + 1, isPublic = c.isPublic, createdAt = clock.nowMillis(), updatedAt = clock.nowMillis()))
                c.animeIds.forEachIndexed { i, animeId ->
                    val entry = dao.get(animeId)
                    collections.insertItem(CollectionItemEntity(id, animeId, c.titles.getOrNull(i) ?: entry?.title ?: "Anime #$animeId", entry?.coverUrl, entry?.color, i, clock.nowMillis()))
                }
            }
        }
        return ImportReport(added, updated, skipped, export.collections.size)
    }
}

@Singleton
class CollectionsRepository @Inject constructor(
    private val db: KazeDatabase,
    private val dao: CollectionDao,
    private val clock: Clock,
) {
    val collections: Flow<List<AnimeCollection>> =
        combine(dao.observeCollections(), dao.observeAllItems()) { cols, items ->
            val byCol = items.groupBy { it.collectionId }
            cols.map { it.toDomain(byCol[it.id].orEmpty()) }
        }

    fun collection(id: Long): Flow<AnimeCollection?> =
        combine(dao.observeCollection(id), dao.observeItems(id)) { c, items -> c?.toDomain(items) }

    fun collectionsContaining(animeId: Int): Flow<List<Long>> = dao.observeCollectionsFor(animeId)

    suspend fun create(name: String, description: String, isPublic: Boolean): Long {
        val clean = name.trim().take(60)
        require(clean.isNotEmpty()) { "Collection name is required" }
        return dao.insertCollection(
            CollectionEntity(name = clean, description = description.trim().take(280), position = dao.maxCollectionPosition() + 1, isPublic = isPublic, createdAt = clock.nowMillis(), updatedAt = clock.nowMillis())
        )
    }

    suspend fun update(id: Long, name: String, description: String, isPublic: Boolean) {
        val current = dao.allCollections().firstOrNull { it.id == id } ?: return
        dao.upsertCollection(current.copy(name = name.trim().take(60).ifEmpty { current.name }, description = description.trim().take(280), isPublic = isPublic, updatedAt = clock.nowMillis()))
    }

    suspend fun delete(id: Long) = dao.deleteCollectionCascade(id)

    suspend fun add(collectionId: Long, anime: Anime) =
        dao.insertItem(CollectionItemEntity(collectionId, anime.id, anime.displayTitle, anime.coverUrl, anime.color, dao.maxItemPosition(collectionId) + 1, clock.nowMillis()))

    suspend fun addEntry(collectionId: Long, entry: LibraryEntry) =
        dao.insertItem(CollectionItemEntity(collectionId, entry.animeId, entry.title, entry.coverUrl, entry.color, dao.maxItemPosition(collectionId) + 1, clock.nowMillis()))

    suspend fun remove(collectionId: Long, animeId: Int) = dao.removeItem(collectionId, animeId)

    suspend fun reorderCollections(orderedIds: List<Long>) = db.withTransaction {
        val all = dao.allCollections().associateBy { it.id }
        dao.upsertCollections(orderedIds.mapIndexedNotNull { i, id -> all[id]?.copy(position = i) })
    }

    suspend fun reorderItems(collectionId: Long, orderedAnimeIds: List<Int>) = db.withTransaction {
        val items = dao.allItems().filter { it.collectionId == collectionId }.associateBy { it.animeId }
        dao.upsertItems(orderedAnimeIds.mapIndexedNotNull { i, id -> items[id]?.copy(position = i) })
    }

    private fun CollectionEntity.toDomain(items: List<CollectionItemEntity>) = AnimeCollection(
        id, name, description, isPublic, position,
        items.sortedBy { it.position }.map { CollectionItem(it.animeId, it.title, it.coverUrl, it.color, it.position) },
    )
}

@Singleton
class ProgressRepository @Inject constructor(
    private val dao: PlaybackDao,
    private val clock: Clock,
) {
    val continueWatching: Flow<List<WatchProgress>> = dao.observeContinueWatching().map { list -> list.map { it.toDomain() } }
    val history: Flow<List<WatchProgress>> = dao.observeHistory().map { list -> list.map { it.toDomain() } }
    val totalWatchMs: Flow<Long> = dao.observeTotalWatchMs()

    fun forAnime(animeId: Int): Flow<List<WatchProgress>> = dao.observeForAnime(animeId).map { l -> l.map { it.toDomain() } }

    suspend fun get(animeId: Int, episode: Int): WatchProgress? = dao.get("$animeId:$episode")?.toDomain()

    suspend fun save(animeId: Int, episode: Int, title: String, cover: String?, banner: String?, positionMs: Long, durationMs: Long) {
        if (durationMs <= 0 || positionMs < 0) return
        // A player opened and closed within seconds is not something to "continue".
        if (positionMs < MIN_RESUMABLE_MS && dao.get("$animeId:$episode") == null) return
        val completed = positionMs >= durationMs * 0.92
        dao.upsert(PlaybackProgressEntity("$animeId:$episode", animeId, episode, title, cover, banner, positionMs, durationMs, completed, clock.nowMillis()))
    }

    suspend fun clear(animeId: Int) = dao.clearAnime(animeId)

    private companion object {
        const val MIN_RESUMABLE_MS = 10_000L
    }

    private fun PlaybackProgressEntity.toDomain() = WatchProgress(animeId, episode, animeTitle, coverUrl, bannerUrl, positionMs, durationMs, completed, updatedAt)
}
