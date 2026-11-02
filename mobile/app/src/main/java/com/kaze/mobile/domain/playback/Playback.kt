package com.kaze.mobile.domain.playback

import com.kaze.mobile.core.common.Outcome

/**
 * Playback is deliberately separated from anime metadata:
 *  - AniList tells us *what* an anime is. It grants no right to stream anything.
 *  - A [MediaProvider] answers *whether and how* this user may play an episode
 *    ([PlaybackEntitlement]) and returns a [PlaybackSource].
 * Providers are replaceable; KAZE ships an authorized provider connecting to Orunei.
 */
interface MediaProvider {
    val id: String
    suspend fun availability(animeId: Int, episode: Int): MediaAvailability
    suspend fun resolve(animeId: Int, episode: Int, animeTitle: String): Outcome<PlaybackSource> =
        resolve(animeId, episode, animeTitle, preferredAudio = "sub")
    suspend fun resolve(animeId: Int, episode: Int, animeTitle: String, preferredAudio: String = "sub"): Outcome<PlaybackSource>
}

enum class MediaAvailability { AVAILABLE_DEMO, AVAILABLE_LICENSED, UNAVAILABLE }

sealed interface PlaybackEntitlement {
    /** Openly licensed / explicitly published test media that anyone may stream. */
    data class OpenDemo(val license: String) : PlaybackEntitlement
    /** Reserved for a real licensed provider (would carry a token from that provider's backend). */
    data class Licensed(val provider: String, val expiresAt: Long) : PlaybackEntitlement
}

data class SideloadedSubtitle(val url: String, val language: String, val label: String, val mimeType: String)

enum class SkipKind { INTRO, CREDITS }

data class SkipMarker(val kind: SkipKind, val startMs: Long, val endMs: Long, val source: String)

data class PlaybackSource(
    val uri: String,
    val mimeType: String,
    val mediaTitle: String,
    val attribution: String,
    val entitlement: PlaybackEntitlement,
    val subtitles: List<SideloadedSubtitle> = emptyList(),
    val skipMarkers: List<SkipMarker> = emptyList(),
    /** Shown on screen whenever the media is not the anime episode itself. */
    val demoNotice: String? = null,
    val audioLanguage: String? = null,
    val isDubbedAvailable: Boolean = false,
)

object SkipLogic {
    /** The marker the playhead is inside of, if any (with a small lead-in so the button appears early). */
    fun activeMarker(positionMs: Long, markers: List<SkipMarker>): SkipMarker? =
        markers.firstOrNull { positionMs >= it.startMs && positionMs < it.endMs - 1_000 }
}
