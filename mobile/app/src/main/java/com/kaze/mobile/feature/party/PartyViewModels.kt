package com.kaze.mobile.feature.party

import android.content.Context
import android.net.Uri
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.VideoSize
import androidx.media3.exoplayer.ExoPlayer
import androidx.navigation.toRoute
import com.kaze.mobile.core.common.KazeError
import com.kaze.mobile.core.common.Outcome
import com.kaze.mobile.data.backend.ConnectionState
import com.kaze.mobile.data.backend.LocalDemoPartyTransport
import com.kaze.mobile.data.backend.PartyRepository
import com.kaze.mobile.data.backend.PartyTransport
import com.kaze.mobile.data.backend.Reaction
import com.kaze.mobile.data.backend.SocialRepository
import com.kaze.mobile.data.backend.parseIsoMillis
import com.kaze.mobile.data.backend.toPlaybackState
import com.kaze.mobile.data.library.ActivityTypes
import com.kaze.mobile.data.library.LibraryRepository
import com.kaze.mobile.domain.model.LibraryEntry
import com.kaze.mobile.domain.party.PartySync
import com.kaze.mobile.domain.party.SyncCorrection
import com.kaze.mobile.domain.playback.MediaProvider
import com.kaze.mobile.domain.playback.PlaybackSource
import com.kaze.mobile.domain.social.Party
import com.kaze.mobile.domain.social.PartyMember
import com.kaze.mobile.domain.social.PartyMessage
import com.kaze.mobile.domain.social.Profile
import com.kaze.mobile.navigation.PartiesRoute
import com.kaze.mobile.navigation.PartyRoomRoute
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject
import kotlin.math.abs

@HiltViewModel
class PartiesViewModel @Inject constructor(
    savedState: SavedStateHandle,
    private val repo: PartyRepository,
    private val libraryRepo: LibraryRepository,
) : ViewModel() {
    val preselect = savedState.toRoute<PartiesRoute>()
    val available get() = repo.isAvailable
    val library: StateFlow<List<LibraryEntry>> = libraryRepo.entries.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val parties = MutableStateFlow<List<Party>>(emptyList())
    val busy = MutableStateFlow(false)
    val error = MutableStateFlow<String?>(null)
    private val _open = Channel<Party>(Channel.BUFFERED)
    val open = _open.receiveAsFlow()

    init { refresh() }

    fun refresh() = viewModelScope.launch { if (repo.isAvailable) (repo.myParties() as? Outcome.Success)?.let { parties.value = it.value } }

    fun create(animeId: Int, title: String, cover: String?, episode: Int) = viewModelScope.launch {
        busy.value = true; error.value = null
        when (val r = repo.create(animeId, title, cover, episode)) {
            is Outcome.Success -> { libraryRepo.logEvent(ActivityTypes.PARTY_HOSTED, animeId, title, null); _open.send(r.value) }
            is Outcome.Failure -> error.value = r.error.userMessage
        }
        busy.value = false
    }

    fun join(code: String) = viewModelScope.launch {
        busy.value = true; error.value = null
        when (val r = repo.join(code)) {
            is Outcome.Success -> _open.send(r.value)
            is Outcome.Failure -> error.value = r.error.userMessage
        }
        busy.value = false
    }
}

data class RoomUi(
    val loading: Boolean = true,
    val error: String? = null,
    val source: PlaybackSource? = null,
    val positionMs: Long = 0,
    val durationMs: Long = 0,
    val isPlaying: Boolean = false,
    val buffering: Boolean = false,
    val driftMs: Long = 0,
    val videoAspect: Float = 16f / 9f,
    val ended: Boolean = false,
    val becameHost: Boolean = false,
)

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class PartyRoomViewModel @Inject constructor(
    savedState: SavedStateHandle,
    @ApplicationContext context: Context,
    private val repo: PartyRepository,
    private val provider: MediaProvider,
    private val social: SocialRepository,
) : ViewModel() {
    val route = savedState.toRoute<PartyRoomRoute>()

    /** Each member owns an independent player and resolves media through their own entitlement. */
    val player: ExoPlayer = ExoPlayer.Builder(context)
        .setAudioAttributes(AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MOVIE).build(), true)
        .build()

    private val _transport = MutableStateFlow<PartyTransport?>(null)
    val transport = _transport.asStateFlow()
    private val _ui = MutableStateFlow(RoomUi())
    val ui = _ui.asStateFlow()

    val party: StateFlow<Party?> = _transport.flatMapLatest { it?.party ?: flowOf(null) }.stateIn(viewModelScope, SharingStarted.Eagerly, null)
    val messages: StateFlow<List<PartyMessage>> = _transport.flatMapLatest { it?.messages ?: emptyFlow() }.stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())
    val members: StateFlow<List<PartyMember>> = _transport.flatMapLatest { it?.members ?: emptyFlow() }.stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())
    val online: StateFlow<Set<String>> = _transport.flatMapLatest { it?.online ?: emptyFlow() }.stateIn(viewModelScope, SharingStarted.Eagerly, emptySet())
    val reactions: StateFlow<List<Reaction>> = _transport.flatMapLatest { it?.reactions ?: emptyFlow() }.stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())
    val connection: StateFlow<ConnectionState> = _transport.flatMapLatest { it?.connection ?: flowOf(ConnectionState.CONNECTING) }.stateIn(viewModelScope, SharingStarted.Eagerly, ConnectionState.CONNECTING)

    val friends = MutableStateFlow<List<Profile>>(emptyList())
    private val _toasts = Channel<String>(Channel.BUFFERED)
    val toasts = _toasts.receiveAsFlow()

    private var loadedEpisode = -1
    private var suppressCorrectionsUntil = 0L
    private var syncJob: Job? = null
    private var wasHost: Boolean? = null

    val isHost: Boolean get() = party.value?.hostId == _transport.value?.myUserId

    private val listener = object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) { _ui.update { it.copy(isPlaying = isPlaying) } }
        override fun onPlaybackStateChanged(state: Int) { _ui.update { it.copy(buffering = state == Player.STATE_BUFFERING) } }
        override fun onVideoSizeChanged(v: VideoSize) { if (v.width > 0 && v.height > 0) _ui.update { it.copy(videoAspect = v.width.toFloat() / v.height) } }
    }

    init {
        player.addListener(listener)
        viewModelScope.launch { open() }
    }

    private suspend fun open() {
        val t: PartyTransport = when {
            route.code == LOCAL_CODE -> LocalDemoPartyTransport(
                Party("local", LOCAL_CODE, "local-you", route.animeId, route.title.ifBlank { "Demo room" }, route.cover, stateUpdatedAt = Instant.now().toString())
            )
            !repo.isAvailable -> { _ui.update { it.copy(loading = false, error = KazeError.NotConfigured.userMessage) }; return }
            else -> when (val r = repo.join(route.code)) {
                is Outcome.Success -> repo.open(r.value)
                is Outcome.Failure -> { _ui.update { it.copy(loading = false, error = r.error.userMessage) }; return }
            }
        }
        _transport.value = t
        _ui.update { it.copy(loading = false) }
        if (!t.isDemo) viewModelScope.launch { (social.friends() as? Outcome.Success)?.let { friends.value = it.value } }
        startSync(t)
    }

    private fun startSync(t: PartyTransport) {
        syncJob?.cancel()
        syncJob = viewModelScope.launch {
            while (isActive) {
                val p = t.party.value
                if (p != null) {
                    val nowHost = p.hostId == t.myUserId
                    if (wasHost == false && nowHost) { _ui.update { it.copy(becameHost = true) }; _toasts.send("The host left — you're the host now") }
                    wasHost = nowHost
                    val expired = p.endedAt != null || (p.expiresAt?.let { parseIsoMillis(it) in 1..System.currentTimeMillis() } ?: false)
                    if (expired) { player.pause(); _ui.update { it.copy(ended = true) } }
                    else {
                        if (loadedEpisode != p.episode) loadEpisode(p)
                        val state = p.toPlaybackState()
                        val serverNow = t.serverNow()
                        val expected = PartySync.expectedPositionMs(state, serverNow)
                        if (System.currentTimeMillis() > suppressCorrectionsUntil && _ui.value.source != null && player.playbackState != Player.STATE_IDLE) {
                            val dur = player.duration.takeIf { it > 0 } ?: Long.MAX_VALUE
                            PartySync.corrections(player.currentPosition, player.playWhenReady, loadedEpisode, state, serverNow, dur).forEach { c ->
                                when (c) {
                                    is SyncCorrection.Seek -> player.seekTo(c.toMs)
                                    is SyncCorrection.Rate -> if (abs(player.playbackParameters.speed - c.rate) > 0.004f) player.setPlaybackSpeed(c.rate)
                                    SyncCorrection.Play -> player.play()
                                    SyncCorrection.Pause -> player.pause()
                                    is SyncCorrection.ChangeEpisode -> loadEpisode(p)
                                }
                            }
                        }
                        _ui.update { it.copy(positionMs = player.currentPosition, durationMs = player.duration.coerceAtLeast(0), driftMs = player.currentPosition - expected) }
                    }
                }
                delay(500)
            }
        }
    }

    private suspend fun loadEpisode(p: Party) {
        loadedEpisode = p.episode
        when (val r = provider.resolve(p.animeId, p.episode, p.animeTitle)) {
            is Outcome.Success -> {
                val src = r.value
                player.setMediaItem(MediaItem.Builder().setUri(src.uri).setMimeType(src.mimeType)
                    .setSubtitleConfigurations(src.subtitles.map { s -> MediaItem.SubtitleConfiguration.Builder(Uri.parse(s.url)).setMimeType(s.mimeType).setLanguage(s.language).setLabel(s.label).build() })
                    .build())
                player.prepare()
                _ui.update { it.copy(source = src) }
            }
            is Outcome.Failure -> _ui.update { it.copy(error = r.error.userMessage) }
        }
    }

    // --------- Host controls: optimistic locally, authoritative on the server ---------
    private fun command(playing: Boolean, positionMs: Long, episode: Int = loadedEpisode.coerceAtLeast(1)) {
        val t = _transport.value ?: return
        if (!isHost) { viewModelScope.launch { _toasts.send("Only the host controls playback") }; return }
        suppressCorrectionsUntil = System.currentTimeMillis() + 2_500
        if (playing) player.play() else player.pause()
        player.seekTo(positionMs)
        viewModelScope.launch {
            when (val r = t.updateState(playing, positionMs, 1f, episode)) {
                is Outcome.Success -> suppressCorrectionsUntil = 0
                is Outcome.Failure -> { suppressCorrectionsUntil = 0; _toasts.send(r.error.userMessage) }
            }
        }
    }

    fun togglePlay() = command(!player.playWhenReady, player.currentPosition)
    fun seekBy(delta: Long) = command(player.playWhenReady, (player.currentPosition + delta).coerceAtLeast(0))
    fun seekTo(ms: Long) = command(player.playWhenReady, ms)
    fun nextEpisode() { if (isHost) { loadedEpisode = -1; command(false, 0, (party.value?.episode ?: 1) + 1) } }

    fun sendChat(text: String) = viewModelScope.launch { _transport.value?.sendChat(text)?.let { if (it is Outcome.Failure) _toasts.send(it.error.userMessage) } }
    fun react(emoji: String) = _transport.value?.react(emoji)
    fun invite(friend: Profile) = viewModelScope.launch {
        val r = _transport.value?.invite(friend.id) ?: return@launch
        _toasts.send(if (r is Outcome.Success) "Invited ${friend.name}" else (r as Outcome.Failure).error.userMessage)
    }

    fun leave(done: () -> Unit) = viewModelScope.launch {
        _transport.value?.leave()
        done()
    }

    override fun onCleared() {
        syncJob?.cancel()
        _transport.value?.close()
        player.removeListener(listener)
        player.release()
    }

    companion object { const val LOCAL_CODE = "LOCAL" }
}
