@file:androidx.annotation.OptIn(markerClass = [androidx.media3.common.util.UnstableApi::class])

package com.kaze.mobile.feature.player

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.Format
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.common.VideoSize
import androidx.media3.exoplayer.DecoderReuseEvaluation
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.analytics.AnalyticsListener
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import androidx.media3.exoplayer.upstream.DefaultBandwidthMeter
import androidx.media3.session.MediaSession
import com.kaze.mobile.core.common.Outcome
import com.kaze.mobile.core.di.ApplicationScope
import kotlinx.coroutines.CoroutineScope
import com.kaze.mobile.core.datastore.UserPreferencesRepository
import com.kaze.mobile.core.datastore.UserPrefs
import com.kaze.mobile.data.library.LibraryRepository
import com.kaze.mobile.data.library.ProgressRepository
import com.kaze.mobile.data.playback.DownloadRepository
import com.kaze.mobile.domain.playback.MediaProvider
import com.kaze.mobile.domain.playback.PlaybackSource
import com.kaze.mobile.domain.playback.SkipKind
import com.kaze.mobile.domain.playback.SkipLogic
import com.kaze.mobile.domain.playback.SkipMarker
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class FitMode(val label: String) { FIT("Ajustar"), FILL("Llenar"), ZOOM("Zoom") }

data class TrackOption(val id: String, val label: String, val selected: Boolean, val groupIndex: Int, val trackIndex: Int)

data class PlaybackStats(
    val resolution: String = "—",
    val videoBitrateKbps: Int? = null,
    val bandwidthEstimateKbps: Long? = null,
    val bufferAheadMs: Long = 0,
    val droppedFrames: Int = 0,
    val videoCodec: String? = null,
    val audioCodec: String? = null,
)

data class PlayerUi(
    val request: PlaybackRequest? = null,
    val source: PlaybackSource? = null,
    val isPlaying: Boolean = false,
    val buffering: Boolean = true,
    val ended: Boolean = false,
    val positionMs: Long = 0,
    val durationMs: Long = 0,
    val bufferedMs: Long = 0,
    val error: String? = null,
    val speed: Float = 1f,
    val volume: Float = 1f,
    val muted: Boolean = false,
    val videoAspect: Float = 16f / 9f,
    val qualities: List<TrackOption> = emptyList(),
    val autoQuality: Boolean = true,
    val audioTracks: List<TrackOption> = emptyList(),
    val textTracks: List<TrackOption> = emptyList(),
    val subtitlesOff: Boolean = false,
    val stats: PlaybackStats = PlaybackStats(),
    val activeSkip: SkipMarker? = null,
    val nextCountdown: Int? = null,
    val fitMode: FitMode = FitMode.FIT,
    val resumedFromMs: Long? = null,
    val speedBoost: Boolean = false,
    val currentAudioOption: String = "sub",
    val isDubbedAvailable: Boolean = false,
) {
    val hasNext: Boolean get() = request?.let { r -> r.totalEpisodes == null || r.episode < r.totalEpisodes } ?: false
    val hasPrevious: Boolean get() = (request?.episode ?: 1) > 1
}

/**
 * Owns the ExoPlayer and MediaSession for the player screen. Living in a ViewModel means
 * rotation and PiP transitions never rebuild the pipeline; [onCleared] releases everything.
 */
@HiltViewModel
class PlayerViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val provider: MediaProvider,
    private val progressRepo: ProgressRepository,
    private val library: LibraryRepository,
    private val prefsRepo: UserPreferencesRepository,
    val downloadRepo: DownloadRepository,
    @ApplicationScope private val appScope: CoroutineScope,
) : ViewModel() {

    private val trackSelector = DefaultTrackSelector(context)
    val player: ExoPlayer = ExoPlayer.Builder(context)
        .setTrackSelector(trackSelector)
        .setBandwidthMeter(DefaultBandwidthMeter.getSingletonInstance(context))
        .setAudioAttributes(AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MOVIE).build(), true)
        .setHandleAudioBecomingNoisy(true)
        .setSeekBackIncrementMs(10_000)
        .setSeekForwardIncrementMs(10_000)
        .build()

    val session: MediaSession = MediaSession.Builder(context, player).setId("kaze-player").build()

    private val _ui = MutableStateFlow(PlayerUi())
    val ui: StateFlow<PlayerUi> = _ui.asStateFlow()
    val prefs: StateFlow<UserPrefs?> = prefsRepo.prefs.stateIn(viewModelScope, SharingStarted.Eagerly, null)

    private var tickJob: Job? = null
    private var countdownJob: Job? = null
    private var lastSavedAt = 0L
    private var markedEpisodeWatched = false
    private var skippedMarkers = mutableSetOf<SkipMarker>()

    private val listener = object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) {
            _ui.update { it.copy(isPlaying = isPlaying) }
            if (!isPlaying) saveProgress(force = true)
        }
        override fun onPlaybackStateChanged(state: Int) {
            _ui.update { it.copy(buffering = state == Player.STATE_BUFFERING, ended = state == Player.STATE_ENDED, durationMs = player.duration.coerceAtLeast(0)) }
            if (state == Player.STATE_READY) _ui.update { it.copy(error = null) }
            if (state == Player.STATE_ENDED) onEnded()
        }
        override fun onPlayerError(error: PlaybackException) {
            _ui.update { it.copy(error = describe(error), buffering = false) }
        }
        override fun onVideoSizeChanged(videoSize: VideoSize) {
            if (videoSize.width > 0 && videoSize.height > 0) {
                _ui.update { it.copy(videoAspect = videoSize.width * videoSize.pixelWidthHeightRatio / videoSize.height, stats = it.stats.copy(resolution = "${videoSize.width}×${videoSize.height}")) }
            }
        }
        override fun onTracksChanged(tracks: Tracks) = refreshTracks(tracks)
        override fun onPlaybackParametersChanged(p: PlaybackParameters) { _ui.update { it.copy(speed = p.speed) } }
        override fun onVolumeChanged(volume: Float) { _ui.update { it.copy(volume = volume, muted = volume == 0f) } }
    }

    private val analytics = object : AnalyticsListener {
        override fun onBandwidthEstimate(eventTime: AnalyticsListener.EventTime, totalLoadTimeMs: Int, totalBytesLoaded: Long, bitrateEstimate: Long) {
            _ui.update { it.copy(stats = it.stats.copy(bandwidthEstimateKbps = bitrateEstimate / 1000)) }
        }
        override fun onDroppedVideoFrames(eventTime: AnalyticsListener.EventTime, droppedFrames: Int, elapsedMs: Long) {
            _ui.update { it.copy(stats = it.stats.copy(droppedFrames = it.stats.droppedFrames + droppedFrames)) }
        }
        override fun onVideoInputFormatChanged(eventTime: AnalyticsListener.EventTime, format: Format, decoderReuseEvaluation: DecoderReuseEvaluation?) {
            _ui.update { it.copy(stats = it.stats.copy(videoBitrateKbps = format.bitrate.takeIf { b -> b > 0 }?.div(1000), videoCodec = format.codecs ?: format.sampleMimeType)) }
        }
        override fun onAudioInputFormatChanged(eventTime: AnalyticsListener.EventTime, format: Format, decoderReuseEvaluation: DecoderReuseEvaluation?) {
            _ui.update { it.copy(stats = it.stats.copy(audioCodec = format.codecs ?: format.sampleMimeType)) }
        }
    }

    init {
        player.addListener(listener)
        player.addAnalyticsListener(analytics)
    }

    fun start(request: PlaybackRequest) {
        if (_ui.value.request == request) return
        load(request)
    }

    private fun load(request: PlaybackRequest, audio: String = _ui.value.currentAudioOption) {
        countdownJob?.cancel()
        markedEpisodeWatched = false
        skippedMarkers.clear()
        _ui.update { PlayerUi(request = request, fitMode = it.fitMode, speed = it.speed, currentAudioOption = audio) }
        viewModelScope.launch {
            val p = prefsRepo.prefs.filterNotNull().first()
            when (val r = provider.resolve(request.animeId, request.episode, request.title, preferredAudio = audio)) {
                is Outcome.Failure -> _ui.update { it.copy(error = r.error.userMessage, buffering = false) }
                is Outcome.Success -> {
                    val src = r.value
                    val item = MediaItem.Builder()
                        .setUri(src.uri)
                        .setMimeType(src.mimeType)
                        .setMediaId("${request.animeId}:${request.episode}")
                        .setMediaMetadata(
                            MediaMetadata.Builder()
                                .setTitle("${request.title} · EP ${request.episode}")
                                .setArtist(src.mediaTitle)
                                .setArtworkUri(request.coverUrl?.let(Uri::parse))
                                .build()
                        )
                        .setSubtitleConfigurations(src.subtitles.map { s ->
                            MediaItem.SubtitleConfiguration.Builder(Uri.parse(s.url)).setMimeType(s.mimeType).setLanguage(s.language).setLabel(s.label).build()
                        })
                        .build()
                    player.trackSelectionParameters = player.trackSelectionParameters.buildUpon()
                        .setPreferredTextLanguage(p.preferredSubtitleLanguage)
                        .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
                        .build()
                    val resume = progressRepo.get(request.animeId, request.episode)
                        ?.takeIf { !it.completed && it.positionMs > 10_000 }?.positionMs
                    player.setMediaItem(item, resume ?: 0L)
                    player.setPlaybackSpeed(p.playbackSpeed)
                    player.prepare()
                    player.playWhenReady = true
                    _ui.update { it.copy(source = src, resumedFromMs = resume, speed = p.playbackSpeed, isDubbedAvailable = src.isDubbedAvailable, currentAudioOption = audio) }
                    startTicker()
                }
            }
        }
    }

    fun switchAudio(audio: String) {
        if (audio == _ui.value.currentAudioOption) return
        val r = _ui.value.request ?: return
        val currentPos = player.currentPosition
        _ui.update { it.copy(currentAudioOption = audio, buffering = true) }
        viewModelScope.launch {
            when (val res = provider.resolve(r.animeId, r.episode, r.title, preferredAudio = audio)) {
                is Outcome.Failure -> _ui.update { it.copy(error = res.error.userMessage, buffering = false) }
                is Outcome.Success -> {
                    val src = res.value
                    val item = MediaItem.Builder()
                        .setUri(src.uri)
                        .setMimeType(src.mimeType)
                        .setMediaId("${r.animeId}:${r.episode}")
                        .setMediaMetadata(
                            MediaMetadata.Builder()
                                .setTitle("${r.title} · EP ${r.episode}")
                                .setArtist(src.mediaTitle)
                                .setArtworkUri(r.coverUrl?.let(Uri::parse))
                                .build()
                        )
                        .setSubtitleConfigurations(src.subtitles.map { s ->
                            MediaItem.SubtitleConfiguration.Builder(Uri.parse(s.url)).setMimeType(s.mimeType).setLanguage(s.language).setLabel(s.label).build()
                        })
                        .build()
                    player.setMediaItem(item, currentPos)
                    player.prepare()
                    player.playWhenReady = true
                    _ui.update { it.copy(source = src, buffering = false, isDubbedAvailable = src.isDubbedAvailable, currentAudioOption = audio) }
                }
            }
        }
    }

    fun downloadCurrentEpisode() {
        val r = _ui.value.request ?: return
        downloadRepo.startDownload(
            animeId = r.animeId,
            episode = r.episode,
            animeTitle = r.title,
            coverUrl = r.coverUrl,
            audio = _ui.value.currentAudioOption,
        )
    }

    private fun startTicker() {
        tickJob?.cancel()
        tickJob = viewModelScope.launch {
            while (isActive) {
                val pos = player.currentPosition
                val skip = _ui.value.source?.let { SkipLogic.activeMarker(pos, it.skipMarkers) }
                _ui.update {
                    it.copy(
                        positionMs = pos,
                        durationMs = player.duration.coerceAtLeast(0),
                        bufferedMs = player.bufferedPosition,
                        activeSkip = skip,
                        stats = it.stats.copy(bufferAheadMs = (player.bufferedPosition - pos).coerceAtLeast(0)),
                    )
                }
                if (skip != null && skip.kind == SkipKind.INTRO && prefs.value?.skipIntroAutomatically == true && skip !in skippedMarkers) {
                    skippedMarkers += skip
                    player.seekTo(skip.endMs)
                }
                if (player.isPlaying) saveProgress(force = false)
                delay(if (player.isPlaying) 250 else 750)
            }
        }
    }

    private fun saveProgress(force: Boolean) {
        val r = _ui.value.request ?: return
        val now = System.currentTimeMillis()
        if (!force && now - lastSavedAt < 5_000) return
        lastSavedAt = now
        val pos = player.currentPosition
        val dur = player.duration
        if (dur <= 0) return
        appScope.launch {
            progressRepo.save(r.animeId, r.episode, r.title, r.coverUrl, r.bannerUrl, pos, dur)
            if (!markedEpisodeWatched && pos >= dur * 0.92) {
                markedEpisodeWatched = true
                library.entry(r.animeId).first()?.let { e -> if (e.progress < r.episode) library.setProgress(r.animeId, r.episode) }
            }
        }
    }

    private fun onEnded() {
        saveProgress(force = true)
        val ui = _ui.value
        if (!ui.hasNext || prefs.value?.autoNext == false) return
        countdownJob?.cancel()
        countdownJob = viewModelScope.launch {
            for (s in 8 downTo 1) { _ui.update { it.copy(nextCountdown = s) }; delay(1_000) }
            _ui.update { it.copy(nextCountdown = null) }
            next()
        }
    }

    fun cancelAutoNext() { countdownJob?.cancel(); _ui.update { it.copy(nextCountdown = null) } }

    // ---------------- Controls ----------------
    fun togglePlay() { if (player.isPlaying) player.pause() else { if (player.playbackState == Player.STATE_ENDED) player.seekTo(0); player.play() } }
    fun play() = player.play()
    fun pause() = player.pause()
    fun seekTo(ms: Long) { player.seekTo(ms.coerceIn(0, player.duration.coerceAtLeast(0))); _ui.update { it.copy(positionMs = player.currentPosition) } }
    fun seekBy(deltaMs: Long) = seekTo(player.currentPosition + deltaMs)
    fun next() { _ui.value.request?.takeIf { _ui.value.hasNext }?.let { load(it.copy(episode = it.episode + 1)) } }
    fun previous() { _ui.value.request?.takeIf { _ui.value.hasPrevious }?.let { load(it.copy(episode = it.episode - 1)) } }
    fun retry() { _ui.update { it.copy(error = null, buffering = true) }; player.prepare(); player.play() }
    fun skip(marker: SkipMarker) { skippedMarkers += marker; seekTo(marker.endMs) }
    fun setFitMode(m: FitMode) = _ui.update { it.copy(fitMode = m) }
    fun cycleFitMode() = setFitMode(FitMode.entries[(_ui.value.fitMode.ordinal + 1) % FitMode.entries.size])

    fun setSpeed(s: Float) {
        player.setPlaybackSpeed(s)
        viewModelScope.launch { prefsRepo.setPlaybackSpeed(s) }
    }

    /** Long-press "hold for 2x": temporary, never persisted. */
    fun setSpeedBoost(on: Boolean) {
        val base = prefs.value?.playbackSpeed ?: 1f
        player.setPlaybackSpeed(if (on) (base * 2f).coerceAtMost(3f) else base)
        _ui.update { it.copy(speedBoost = on) }
    }

    fun setSubtitleScale(v: Float) = viewModelScope.launch { prefsRepo.setSubtitleScale(v) }
    fun setAmbient(v: Boolean) = viewModelScope.launch { prefsRepo.setAmbientMode(v) }
    fun setAmbientIntensity(v: Float) = viewModelScope.launch { prefsRepo.setAmbientIntensity(v) }

    fun toggleMute() { player.volume = if (player.volume > 0f) 0f else 1f }

    fun selectQuality(option: TrackOption?) {
        val builder = player.trackSelectionParameters.buildUpon()
        if (option == null) builder.clearOverridesOfType(C.TRACK_TYPE_VIDEO)
        else player.currentTracks.groups.getOrNull(option.groupIndex)?.let { g -> builder.setOverrideForType(TrackSelectionOverride(g.mediaTrackGroup, option.trackIndex)) }
        player.trackSelectionParameters = builder.build()
    }

    fun selectAudio(option: TrackOption) {
        val g = player.currentTracks.groups.getOrNull(option.groupIndex) ?: return
        player.trackSelectionParameters = player.trackSelectionParameters.buildUpon().setOverrideForType(TrackSelectionOverride(g.mediaTrackGroup, option.trackIndex)).build()
    }

    fun selectText(option: TrackOption?) {
        val builder = player.trackSelectionParameters.buildUpon()
        if (option == null) {
            builder.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
        } else {
            val g = player.currentTracks.groups.getOrNull(option.groupIndex) ?: return
            builder.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false).setOverrideForType(TrackSelectionOverride(g.mediaTrackGroup, option.trackIndex))
            g.getTrackFormat(option.trackIndex).language?.let { lang -> viewModelScope.launch { prefsRepo.setSubtitleLanguage(lang) } }
        }
        player.trackSelectionParameters = builder.build()
    }

    private fun refreshTracks(tracks: Tracks) {
        val videos = mutableListOf<TrackOption>()
        val audios = mutableListOf<TrackOption>()
        val texts = mutableListOf<TrackOption>()
        tracks.groups.forEachIndexed { gi, group ->
            for (ti in 0 until group.length) {
                if (!group.isTrackSupported(ti)) continue
                val f = group.getTrackFormat(ti)
                val selected = group.isTrackSelected(ti)
                when (group.type) {
                    C.TRACK_TYPE_VIDEO -> if (f.height > 0) videos += TrackOption("v$gi:$ti", "${f.height}p" + (f.bitrate.takeIf { it > 0 }?.let { " · ${it / 1000} kbps" } ?: ""), selected, gi, ti)
                    C.TRACK_TYPE_AUDIO -> audios += TrackOption("a$gi:$ti", listOfNotNull(f.label, f.language?.uppercase(), f.channelCount.takeIf { it > 0 }?.let { if (it > 2) "$it.1ch" else "${it}ch" }).joinToString(" · ").ifEmpty { "Audio ${audios.size + 1}" }, selected, gi, ti)
                    C.TRACK_TYPE_TEXT -> texts += TrackOption("t$gi:$ti", f.label ?: f.language ?: "Subtitles ${texts.size + 1}", selected, gi, ti)
                }
            }
        }
        val params = player.trackSelectionParameters
        _ui.update {
            it.copy(
                qualities = videos.distinctBy { v -> v.label }.sortedByDescending { v -> v.label.substringBefore('p').toIntOrNull() ?: 0 },
                autoQuality = params.overrides.keys.none { k -> k.type == C.TRACK_TYPE_VIDEO },
                audioTracks = audios,
                textTracks = texts,
                subtitlesOff = C.TRACK_TYPE_TEXT in params.disabledTrackTypes,
            )
        }
    }

    private fun describe(e: PlaybackException): String = when (e.errorCode) {
        PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED, PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT -> "Network problem while streaming. Check your connection and retry."
        PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS -> "The demo stream server refused the request. Try again or pick another episode."
        PlaybackException.ERROR_CODE_DECODER_INIT_FAILED, PlaybackException.ERROR_CODE_DECODING_FORMAT_UNSUPPORTED -> "This device can't decode this stream."
        else -> "Playback error: ${e.errorCodeName}"
    }

    fun onBackground() { saveProgress(force = true) }

    override fun onCleared() {
        saveProgress(force = true)
        tickJob?.cancel()
        countdownJob?.cancel()
        player.removeListener(listener)
        session.release()
        player.release()
    }
}
