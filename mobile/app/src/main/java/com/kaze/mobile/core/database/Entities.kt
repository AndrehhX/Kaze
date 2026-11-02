package com.kaze.mobile.core.database

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import androidx.room.TypeConverter
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json

/** Raw AniList responses kept for offline browsing (stale-while-revalidate). */
@Entity(tableName = "cached_query")
data class CachedQueryEntity(
    @PrimaryKey val key: String,
    val json: String,
    val fetchedAt: Long,
)

/** The library is local-first: Room is the source of truth, sync is layered on top. */
@Entity(tableName = "library_entry", indices = [Index("status"), Index("updatedAt")])
data class LibraryEntryEntity(
    @PrimaryKey val animeId: Int,
    val title: String,
    val coverUrl: String?,
    val bannerUrl: String?,
    val color: String?,
    val genres: List<String>,
    val tags: List<String>,
    val studios: List<String>,
    val format: String?,
    val totalEpisodes: Int?,
    val communityScore: Int?,
    val popularity: Int?,
    val seasonYear: Int?,
    val status: String,            // LibraryStatus.name
    val progress: Int,
    val userScore: Int?,           // 0..100, null = unrated
    val isFavorite: Boolean,
    val rewatchCount: Int,
    val notes: String,
    val addedAt: Long,
    val updatedAt: Long,
    val startedAt: Long?,
    val completedAt: Long?,
    val sortOrder: Int = 0,
    // Sync bookkeeping
    val remoteUpdatedAt: Long? = null,  // last AniList/Supabase timestamp we reconciled with (seconds)
    val dirty: Boolean = true,          // changed locally since last successful sync
)

@Entity(tableName = "collection")
data class CollectionEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val description: String,
    val position: Int,
    val isPublic: Boolean,
    val createdAt: Long,
    val updatedAt: Long,
)

@Entity(tableName = "collection_item", primaryKeys = ["collectionId", "animeId"], indices = [Index("animeId")])
data class CollectionItemEntity(
    val collectionId: Long,
    val animeId: Int,
    val title: String,
    val coverUrl: String?,
    val color: String?,
    val position: Int,
    val addedAt: Long,
)

@Entity(tableName = "playback_progress", indices = [Index("animeId"), Index("updatedAt")])
data class PlaybackProgressEntity(
    @PrimaryKey val key: String,   // "$animeId:$episode"
    val animeId: Int,
    val episode: Int,
    val animeTitle: String,
    val coverUrl: String?,
    val bannerUrl: String?,
    val positionMs: Long,
    val durationMs: Long,
    val completed: Boolean,
    val updatedAt: Long,
)

@Entity(tableName = "achievement")
data class AchievementEntity(
    @PrimaryKey val id: String,
    val unlockedAt: Long,
)

/** Local, private event log: powers watch history, achievements and the guest profile. */
@Entity(tableName = "activity_event", indices = [Index("createdAt")])
data class ActivityEventEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val type: String,
    val animeId: Int?,
    val title: String?,
    val detail: String?,
    val createdAt: Long,
)

class Converters {
    private val json = Json
    private val listSer = ListSerializer(String.serializer())

    @TypeConverter fun fromList(value: List<String>): String = json.encodeToString(listSer, value)
    @TypeConverter fun toList(value: String): List<String> = runCatching { json.decodeFromString(listSer, value) }.getOrDefault(emptyList())
}
