package com.kaze.mobile.domain.party

import kotlin.math.abs

/** Playback state as stored by the server. [updatedAtServerMs] is stamped by the database clock. */
data class PartyPlaybackState(
    val isPlaying: Boolean,
    val positionMs: Long,
    val rate: Float,
    val updatedAtServerMs: Long,
    val episode: Int,
)

sealed interface SyncCorrection {
    data object Play : SyncCorrection
    data object Pause : SyncCorrection
    data class Seek(val toMs: Long) : SyncCorrection
    data class Rate(val rate: Float) : SyncCorrection
    data class ChangeEpisode(val episode: Int) : SyncCorrection
}

/**
 * Server-authoritative synchronisation. Every client independently computes where playback
 * *should* be from the last server state plus elapsed server time, then nudges itself:
 * large drift → seek; small drift → temporary ±8 % rate change (inaudible catch-up);
 * negligible drift → restore the room's rate.
 */
object PartySync {
    const val SEEK_THRESHOLD_MS = 1_500L
    const val NUDGE_THRESHOLD_MS = 200L
    private const val MAX_NUDGE = 0.08f

    fun expectedPositionMs(state: PartyPlaybackState, serverNowMs: Long): Long =
        if (!state.isPlaying) state.positionMs
        else state.positionMs + ((serverNowMs - state.updatedAtServerMs).coerceAtLeast(0) * state.rate).toLong()

    fun corrections(
        localPositionMs: Long,
        localPlaying: Boolean,
        localEpisode: Int,
        state: PartyPlaybackState,
        serverNowMs: Long,
        durationMs: Long = Long.MAX_VALUE,
    ): List<SyncCorrection> {
        if (localEpisode != state.episode) return listOf(SyncCorrection.ChangeEpisode(state.episode))
        val out = mutableListOf<SyncCorrection>()
        val expected = expectedPositionMs(state, serverNowMs).coerceIn(0, durationMs)
        val drift = localPositionMs - expected
        when {
            abs(drift) > SEEK_THRESHOLD_MS -> { out += SyncCorrection.Seek(expected); out += SyncCorrection.Rate(state.rate) }
            state.isPlaying && abs(drift) > NUDGE_THRESHOLD_MS -> {
                // Ahead (drift > 0) → slow down; behind → speed up. Proportional, capped.
                val nudge = (-drift / 4_000f).coerceIn(-MAX_NUDGE, MAX_NUDGE)
                out += SyncCorrection.Rate(state.rate * (1f + nudge))
            }
            else -> out += SyncCorrection.Rate(state.rate)
        }
        if (state.isPlaying && !localPlaying) out += SyncCorrection.Play
        if (!state.isPlaying && localPlaying) out += SyncCorrection.Pause
        return out
    }
}

/**
 * NTP-style clock offset estimation against the server. Keeps the sample with the lowest
 * round-trip time (least network asymmetry) from a sliding window.
 */
class ClockOffsetEstimator(private val window: Int = 8) {
    private data class Sample(val offset: Long, val rtt: Long)
    private val samples = ArrayDeque<Sample>()

    fun addSample(localSendMs: Long, serverMs: Long, localReceiveMs: Long) {
        val rtt = (localReceiveMs - localSendMs).coerceAtLeast(0)
        val offset = serverMs - (localSendMs + localReceiveMs) / 2
        samples.addLast(Sample(offset, rtt))
        while (samples.size > window) samples.removeFirst()
    }

    val hasSamples: Boolean get() = samples.isNotEmpty()
    val offsetMs: Long get() = samples.minByOrNull { it.rtt }?.offset ?: 0L
    val bestRttMs: Long? get() = samples.minByOrNull { it.rtt }?.rtt

    fun serverNow(localNowMs: Long): Long = localNowMs + offsetMs
}

/** Reactions are limited to a fixed palette; free text goes through chat. */
object PartyReactions {
    val palette = listOf("🔥", "😂", "😭", "😱", "❤️", "👏", "🤯", "✨")
    fun isAllowed(r: String) = r in palette
}
