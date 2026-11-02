package com.kaze.mobile.domain.model

import kotlinx.serialization.Serializable

@Serializable
enum class LibraryStatus(val label: String, val anilist: String) {
    WATCHING("Viendo", "CURRENT"),
    COMPLETED("Completado", "COMPLETED"),
    PLANNING("Pendiente", "PLANNING"),
    PAUSED("En pausa", "PAUSED"),
    DROPPED("Abandonado", "DROPPED"),
    REWATCHING("Reviendo", "REPEATING");

    companion object {
        fun fromAniList(value: String?): LibraryStatus? = entries.firstOrNull { it.anilist == value }
        fun fromName(value: String?): LibraryStatus = entries.firstOrNull { it.name == value } ?: PLANNING
    }
}

@Serializable
data class LibraryEntry(
    val animeId: Int,
    val title: String,
    val coverUrl: String? = null,
    val bannerUrl: String? = null,
    val color: String? = null,
    val genres: List<String> = emptyList(),
    val tags: List<String> = emptyList(),
    val studios: List<String> = emptyList(),
    val format: String? = null,
    val totalEpisodes: Int? = null,
    val communityScore: Int? = null,
    val popularity: Int? = null,
    val seasonYear: Int? = null,
    val status: LibraryStatus = LibraryStatus.PLANNING,
    val progress: Int = 0,
    val userScore: Int? = null,
    val isFavorite: Boolean = false,
    val rewatchCount: Int = 0,
    val notes: String = "",
    val addedAt: Long = 0,
    val updatedAt: Long = 0,
    val startedAt: Long? = null,
    val completedAt: Long? = null,
    val sortOrder: Int = 0,
    val remoteUpdatedAt: Long? = null,
    val dirty: Boolean = true,
) {
    val progressFraction: Float get() = totalEpisodes?.takeIf { it > 0 }?.let { progress.toFloat() / it } ?: 0f
}

enum class LibrarySort(val label: String) { RECENT("Actualizados recientemente"), TITLE("Título"), SCORE("Mi calificación"), PROGRESS("Progreso"), ADDED("Fecha agregado"), CUSTOM("Orden manual") }

data class LibraryFilter(
    val status: LibraryStatus? = null,
    val favoritesOnly: Boolean = false,
    val genre: String? = null,
    val query: String = "",
    val sort: LibrarySort = LibrarySort.RECENT,
)

fun List<LibraryEntry>.applyFilter(f: LibraryFilter): List<LibraryEntry> {
    val q = f.query.trim()
    return asSequence()
        .filter { f.status == null || it.status == f.status }
        .filter { !f.favoritesOnly || it.isFavorite }
        .filter { f.genre == null || f.genre in it.genres }
        .filter { q.isEmpty() || it.title.contains(q, ignoreCase = true) }
        .let { seq ->
            when (f.sort) {
                LibrarySort.RECENT -> seq.sortedByDescending { it.updatedAt }
                LibrarySort.TITLE -> seq.sortedBy { it.title.lowercase() }
                LibrarySort.SCORE -> seq.sortedWith(compareByDescending<LibraryEntry> { it.userScore ?: -1 }.thenBy { it.title })
                LibrarySort.PROGRESS -> seq.sortedByDescending { it.progressFraction }
                LibrarySort.ADDED -> seq.sortedByDescending { it.addedAt }
                LibrarySort.CUSTOM -> seq.sortedBy { it.sortOrder }
            }
        }
        .toList()
}

data class AnimeCollection(
    val id: Long,
    val name: String,
    val description: String,
    val isPublic: Boolean,
    val position: Int,
    val items: List<CollectionItem>,
)

data class CollectionItem(val animeId: Int, val title: String, val coverUrl: String?, val color: String?, val position: Int)

data class WatchProgress(
    val animeId: Int,
    val episode: Int,
    val animeTitle: String,
    val coverUrl: String?,
    val bannerUrl: String?,
    val positionMs: Long,
    val durationMs: Long,
    val completed: Boolean,
    val updatedAt: Long,
) {
    val fraction: Float get() = if (durationMs > 0) (positionMs.toFloat() / durationMs).coerceIn(0f, 1f) else 0f
}

/** Portable export format (versioned so imports stay compatible). */
@Serializable
data class LibraryExport(
    val format: String = "kaze-library",
    val version: Int = 1,
    val exportedAt: Long,
    val entries: List<LibraryEntry>,
    val collections: List<ExportedCollection> = emptyList(),
)

@Serializable
data class ExportedCollection(val name: String, val description: String, val isPublic: Boolean, val animeIds: List<Int>, val titles: List<String>)
