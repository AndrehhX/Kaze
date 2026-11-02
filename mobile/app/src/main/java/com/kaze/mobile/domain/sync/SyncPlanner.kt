package com.kaze.mobile.domain.sync

import com.kaze.mobile.domain.model.LibraryEntry
import com.kaze.mobile.domain.model.LibraryStatus

/** A list entry as it exists on a remote service (AniList or the KAZE backend). */
data class RemoteEntry(
    val animeId: Int,
    val status: LibraryStatus,
    val progress: Int,
    val score: Int?,
    val updatedAt: Long,          // seconds, as reported by the remote
    val isFavorite: Boolean = false,
)

data class SyncConflict(val local: LibraryEntry, val remote: RemoteEntry) {
    val differences: List<String> get() = buildList {
        if (local.status != remote.status) add("Status: ${local.status.label} here vs ${remote.status.label} remote")
        if (local.progress != remote.progress) add("Progress: ep ${local.progress} here vs ep ${remote.progress} remote")
        if (local.userScore != remote.score) add("Score: ${local.userScore ?: "—"} here vs ${remote.score ?: "—"} remote")
    }
}

data class SyncPlan(
    val pull: List<RemoteEntry>,          // safe to apply locally (local unchanged since last sync, or new)
    val push: List<LibraryEntry>,         // safe to send (remote unchanged since last sync, or new)
    val conflicts: List<SyncConflict>,    // both sides changed: the user decides, nothing is overwritten
    val alreadyInSync: List<Int>,
) {
    val isEmpty get() = pull.isEmpty() && push.isEmpty() && conflicts.isEmpty()
}

enum class ConflictChoice { KEEP_LOCAL, USE_REMOTE }

/**
 * Three-way reconciliation using the last reconciled remote timestamp as the common ancestor.
 * Guarantees: progress is never silently overwritten — any entry changed on both sides with
 * differing values becomes a [SyncConflict] for the user to resolve.
 */
object SyncPlanner {
    fun plan(local: List<LibraryEntry>, remote: List<RemoteEntry>): SyncPlan {
        val localById = local.associateBy { it.animeId }
        val remoteById = remote.associateBy { it.animeId }
        val pull = mutableListOf<RemoteEntry>()
        val push = mutableListOf<LibraryEntry>()
        val conflicts = mutableListOf<SyncConflict>()
        val same = mutableListOf<Int>()

        for (r in remote) {
            val l = localById[r.animeId]
            if (l == null) { pull += r; continue }
            val remoteChanged = l.remoteUpdatedAt == null || r.updatedAt > l.remoteUpdatedAt
            val equalValues = l.status == r.status && l.progress == r.progress && l.userScore == r.score
            when {
                equalValues -> same += r.animeId
                !l.dirty && remoteChanged -> pull += r
                l.dirty && !remoteChanged -> push += l
                l.dirty && remoteChanged -> conflicts += SyncConflict(l, r)
                // Neither side claims a change but values differ (e.g. first link of accounts): ask.
                else -> conflicts += SyncConflict(l, r)
            }
        }
        for (l in local) if (l.animeId !in remoteById && l.dirty) push += l
        return SyncPlan(pull, push, conflicts, same)
    }
}
