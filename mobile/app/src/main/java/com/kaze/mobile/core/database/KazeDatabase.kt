package com.kaze.mobile.core.database

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters

@Database(
    entities = [
        CachedQueryEntity::class,
        LibraryEntryEntity::class,
        CollectionEntity::class,
        CollectionItemEntity::class,
        PlaybackProgressEntity::class,
        AchievementEntity::class,
        ActivityEventEntity::class,
    ],
    version = 1,
    exportSchema = true,
)
@TypeConverters(Converters::class)
abstract class KazeDatabase : RoomDatabase() {
    abstract fun cacheDao(): CacheDao
    abstract fun libraryDao(): LibraryDao
    abstract fun collectionDao(): CollectionDao
    abstract fun playbackDao(): PlaybackDao
    abstract fun activityDao(): ActivityDao
}
