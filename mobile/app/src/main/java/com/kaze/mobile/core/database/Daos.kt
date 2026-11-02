package com.kaze.mobile.core.database

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

@Dao
interface CacheDao {
    @Query("SELECT * FROM cached_query WHERE `key` = :key")
    suspend fun get(key: String): CachedQueryEntity?

    @Upsert
    suspend fun put(entity: CachedQueryEntity)

    /** Keep the cache bounded: drop the oldest search pages beyond [keep]. */
    @Query("DELETE FROM cached_query WHERE `key` LIKE :prefix || '%' AND `key` NOT IN (SELECT `key` FROM cached_query WHERE `key` LIKE :prefix || '%' ORDER BY fetchedAt DESC LIMIT :keep)")
    suspend fun trim(prefix: String, keep: Int)

    @Query("DELETE FROM cached_query")
    suspend fun clear()
}

@Dao
interface LibraryDao {
    @Query("SELECT * FROM library_entry ORDER BY updatedAt DESC")
    fun observeAll(): Flow<List<LibraryEntryEntity>>

    @Query("SELECT * FROM library_entry")
    suspend fun getAll(): List<LibraryEntryEntity>

    @Query("SELECT * FROM library_entry WHERE animeId = :id")
    fun observe(id: Int): Flow<LibraryEntryEntity?>

    @Query("SELECT * FROM library_entry WHERE animeId = :id")
    suspend fun get(id: Int): LibraryEntryEntity?

    @Upsert
    suspend fun upsert(entry: LibraryEntryEntity)

    @Upsert
    suspend fun upsertAll(entries: List<LibraryEntryEntity>)

    @Query("DELETE FROM library_entry WHERE animeId IN (:ids)")
    suspend fun delete(ids: List<Int>)

    @Query("SELECT * FROM library_entry WHERE dirty = 1")
    suspend fun dirtyEntries(): List<LibraryEntryEntity>

    @Query("UPDATE library_entry SET dirty = 0, remoteUpdatedAt = :remoteUpdatedAt WHERE animeId = :id")
    suspend fun markSynced(id: Int, remoteUpdatedAt: Long)

    @Query("SELECT COUNT(*) FROM library_entry WHERE status = 'COMPLETED'")
    fun observeCompletedCount(): Flow<Int>
}

@Dao
interface CollectionDao {
    @Query("SELECT * FROM collection ORDER BY position ASC, createdAt ASC")
    fun observeCollections(): Flow<List<CollectionEntity>>

    @Query("SELECT * FROM collection WHERE id = :id")
    fun observeCollection(id: Long): Flow<CollectionEntity?>

    @Query("SELECT * FROM collection_item WHERE collectionId = :id ORDER BY position ASC, addedAt ASC")
    fun observeItems(id: Long): Flow<List<CollectionItemEntity>>

    @Query("SELECT * FROM collection_item")
    fun observeAllItems(): Flow<List<CollectionItemEntity>>

    @Query("SELECT collectionId FROM collection_item WHERE animeId = :animeId")
    fun observeCollectionsFor(animeId: Int): Flow<List<Long>>

    @Insert
    suspend fun insertCollection(c: CollectionEntity): Long

    @Upsert
    suspend fun upsertCollection(c: CollectionEntity)

    @Upsert
    suspend fun upsertCollections(c: List<CollectionEntity>)

    @Query("DELETE FROM collection WHERE id = :id")
    suspend fun deleteCollection(id: Long)

    @Query("DELETE FROM collection_item WHERE collectionId = :id")
    suspend fun deleteItemsOf(id: Long)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertItem(item: CollectionItemEntity)

    @Upsert
    suspend fun upsertItems(items: List<CollectionItemEntity>)

    @Query("DELETE FROM collection_item WHERE collectionId = :collectionId AND animeId = :animeId")
    suspend fun removeItem(collectionId: Long, animeId: Int)

    @Query("SELECT COALESCE(MAX(position), -1) FROM collection_item WHERE collectionId = :id")
    suspend fun maxItemPosition(id: Long): Int

    @Query("SELECT COALESCE(MAX(position), -1) FROM collection")
    suspend fun maxCollectionPosition(): Int

    @Query("SELECT * FROM collection")
    suspend fun allCollections(): List<CollectionEntity>

    @Query("SELECT * FROM collection_item")
    suspend fun allItems(): List<CollectionItemEntity>

    @Transaction
    suspend fun deleteCollectionCascade(id: Long) {
        deleteItemsOf(id)
        deleteCollection(id)
    }
}

@Dao
interface PlaybackDao {
    @Query("SELECT * FROM playback_progress WHERE `key` = :key")
    suspend fun get(key: String): PlaybackProgressEntity?

    @Upsert
    suspend fun upsert(p: PlaybackProgressEntity)

    /** One row per anime: its most recently watched episode (the "Continue watching" rail). */
    @Query(
        """SELECT p.* FROM playback_progress p
           INNER JOIN (SELECT animeId, MAX(updatedAt) AS m FROM playback_progress GROUP BY animeId) latest
           ON p.animeId = latest.animeId AND p.updatedAt = latest.m
           ORDER BY p.updatedAt DESC LIMIT :limit"""
    )
    fun observeContinueWatching(limit: Int = 20): Flow<List<PlaybackProgressEntity>>

    @Query("SELECT * FROM playback_progress WHERE animeId = :animeId")
    fun observeForAnime(animeId: Int): Flow<List<PlaybackProgressEntity>>

    @Query("SELECT * FROM playback_progress ORDER BY updatedAt DESC LIMIT :limit")
    fun observeHistory(limit: Int = 100): Flow<List<PlaybackProgressEntity>>

    @Query("SELECT COALESCE(SUM(CASE WHEN completed THEN durationMs ELSE positionMs END), 0) FROM playback_progress")
    fun observeTotalWatchMs(): Flow<Long>

    @Query("DELETE FROM playback_progress WHERE animeId = :animeId")
    suspend fun clearAnime(animeId: Int)
}

@Dao
interface ActivityDao {
    @Insert
    suspend fun insert(e: ActivityEventEntity)

    @Query("SELECT * FROM activity_event ORDER BY createdAt DESC LIMIT :limit")
    fun observeRecent(limit: Int = 50): Flow<List<ActivityEventEntity>>

    @Query("SELECT COUNT(*) FROM activity_event WHERE type = :type")
    suspend fun count(type: String): Int

    @Query("SELECT * FROM achievement")
    fun observeAchievements(): Flow<List<AchievementEntity>>

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun unlock(a: AchievementEntity): Long
}
