package com.kaze.mobile.data.backend

import com.kaze.mobile.core.common.KazeError
import com.kaze.mobile.core.common.KazeException
import com.kaze.mobile.core.common.Outcome
import com.kaze.mobile.core.common.outcomeOf
import com.kaze.mobile.core.text.SafeRichText
import com.kaze.mobile.domain.party.ClockOffsetEstimator
import com.kaze.mobile.domain.party.PartyPlaybackState
import com.kaze.mobile.domain.party.PartyReactions
import com.kaze.mobile.domain.social.Party
import com.kaze.mobile.domain.social.PartyMember
import com.kaze.mobile.domain.social.PartyMessage
import com.kaze.mobile.domain.social.Profile
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.Instant
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/** Parses Postgres/Supabase timestamps ("…+00:00", "…Z" or offset-less UTC) to epoch millis. */
fun parseIsoMillis(s: String?): Long {
    if (s.isNullOrBlank()) return 0L
    val t = s.trim().replace(' ', 'T')
    return runCatching { java.time.OffsetDateTime.parse(t).toInstant().toEpochMilli() }
        .recoverCatching { Instant.parse(t).toEpochMilli() }
        .recoverCatching { java.time.LocalDateTime.parse(t).toInstant(java.time.ZoneOffset.UTC).toEpochMilli() }
        .getOrDefault(0L)
}

fun Party.toPlaybackState() = PartyPlaybackState(isPlaying, positionMs, playbackRate, parseIsoMillis(stateUpdatedAt), episode)

data class Reaction(val emoji: String, val userId: String, val at: Long, val id: String = UUID.randomUUID().toString())

/** One live room. Implemented by the Supabase transport and by a clearly-labelled local demo. */
interface PartyTransport {
    val isDemo: Boolean
    val myUserId: String
    val party: StateFlow<Party?>
    val messages: StateFlow<List<PartyMessage>>
    val members: StateFlow<List<PartyMember>>
    val online: StateFlow<Set<String>>
    val reactions: StateFlow<List<Reaction>>
    val connection: StateFlow<ConnectionState>
    val clock: ClockOffsetEstimator
    fun serverNow(): Long = clock.serverNow(System.currentTimeMillis())
    suspend fun updateState(playing: Boolean, positionMs: Long, rate: Float, episode: Int): Outcome<Unit>
    suspend fun sendChat(text: String): Outcome<Unit>
    fun react(emoji: String)
    suspend fun invite(friendId: String): Outcome<Unit>
    suspend fun leave()
    fun close()
}

/** Fila de `watch_party_rooms`: las MISMAS salas que crea y muestra la web. */
@Serializable
private data class RoomRow(
    val id: String,
    val code: String? = null,
    @SerialName("host_id") val hostId: String,
    val title: String = "",
    @SerialName("series_id") val seriesId: String = "0",
    @SerialName("episode_id") val episodeId: String? = "1",
    @SerialName("is_playing") val isPlaying: Boolean = false,
    @SerialName("position_seconds") val positionSeconds: Double = 0.0,
    @SerialName("playback_rate") val playbackRate: Float = 1f,
    @SerialName("state_updated_at") val stateUpdatedAt: String? = null,
    @SerialName("invite_only") val inviteOnly: Boolean = false,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("ended_at") val endedAt: String? = null,
) {
    // `code` de la ruta = id de la sala: es lo que comparte la web en /watch-parties/<id>.
    fun toParty(cover: String? = null) = Party(
        id = id, code = id, hostId = hostId,
        animeId = seriesId.toIntOrNull() ?: 0,
        animeTitle = title.ifBlank { "Sala de cine" }, animeCover = cover,
        episode = episodeId?.toIntOrNull() ?: 1,
        isPlaying = isPlaying, positionMs = (positionSeconds * 1000).toLong(), playbackRate = playbackRate,
        stateUpdatedAt = stateUpdatedAt ?: Instant.now().toString(),
        // La web da por cerradas las salas de más de 6 horas.
        expiresAt = createdAt?.let { Instant.ofEpochMilli(parseIsoMillis(it) + 6 * 3600_000L).toString() },
        endedAt = endedAt,
    )
}

@Serializable
private data class RoomMessageRow(
    val id: String,
    @SerialName("room_id") val roomId: String,
    @SerialName("user_id") val userId: String,
    val body: String,
    @SerialName("created_at") val createdAt: String,
) {
    fun toMessage() = PartyMessage(id, roomId, userId, "chat", body, createdAt)
}

@Serializable
private data class ParticipantRow(
    @SerialName("user_id") val userId: String,
    @SerialName("joined_at") val joinedAt: String = "",
    @SerialName("left_at") val leftAt: String? = null,
    val profile: Profile? = null,
)

private const val ROOM_COLS = "id,code,host_id,title,series_id,episode_id,is_playing,position_seconds,playback_rate,state_updated_at,invite_only,created_at,ended_at"

@Singleton
class PartyRepository @Inject constructor(
    private val sb: SupabaseClient,
    private val realtime: RealtimeClient,
    private val json: Json,
) {
    val isAvailable get() = sb.config.isConfigured && sb.currentUserId != null
    private val roomSer = ListSerializer(RoomRow.serializer())
    private val me: String get() = sb.currentUserId ?: throw KazeException(KazeError.Unauthorized)

    private suspend fun upsertMe(roomId: String, host: Boolean) {
        sb.insert(
            "watch_party_participants?on_conflict=room_id,user_id",
            mapOf("room_id" to roomId, "user_id" to me, "role" to if (host) "host" else "guest", "left_at" to null).toJsonBody(),
            returning = false, upsert = true,
        )
    }

    suspend fun create(animeId: Int, title: String, cover: String?, episode: Int): Outcome<Party> = outcomeOf {
        val id = UUID.randomUUID().toString()
        val res = sb.insert("watch_party_rooms?select=$ROOM_COLS", mapOf(
            "id" to id, "host_id" to me, "title" to "Sala · $title".take(80),
            "series_id" to animeId.toString(), "episode_id" to episode.toString(), "invite_only" to false,
        ).toJsonBody(), returning = true)
        upsertMe(id, host = true)
        json.decodeFromString(roomSer, res).first().toParty(cover)
    }

    /** Acepta el id de la sala, el enlace de la web (/watch-parties/<id>) o su código. */
    suspend fun join(input: String): Outcome<Party> = outcomeOf {
        val key = input.trim().substringAfterLast('/').substringBefore('?')
        if (key.length < 6) throw KazeException(KazeError.Validation("Pega el enlace o el código de la sala."))
        val filter = if (key.length >= 32) "id=eq.$key" else "code=eq.${key.lowercase()}"
        val room = sb.select("watch_party_rooms", "$filter&select=$ROOM_COLS&limit=1", roomSer).firstOrNull()
            ?: throw KazeException(KazeError.NotFound("Esa sala"))
        if (room.endedAt != null) throw KazeException(KazeError.Validation("Esta sala ya terminó."))
        if (room.inviteOnly && room.hostId != me) {
            val allowed = runCatching { sb.rpc("can_join_room", mapOf("room" to room.id).toJsonBody()).trim() == "true" }.getOrDefault(true)
            if (!allowed) throw KazeException(KazeError.Validation("Sala privada: solo amigos del anfitrión o invitados."))
        }
        upsertMe(room.id, host = room.hostId == me)
        room.toParty()
    }

    /** Salas abiertas, con las mismas reglas que la web: públicas o de amigos, de menos de 6 horas. */
    suspend fun myParties(): Outcome<List<Party>> = outcomeOf {
        val since = Instant.now().minusSeconds(6 * 3600).toString()
        sb.select("watch_party_rooms", "ended_at=is.null&created_at=gt.$since&select=$ROOM_COLS&order=created_at.desc&limit=30", roomSer)
            .map { it.toParty() }
    }

    /** Abre la sala en tiempo real. Cada miembro resuelve el video con su propio reproductor. */
    fun open(party: Party): PartyTransport = RemotePartyTransport(party)

    private inner class RemotePartyTransport(private val initial: Party) : PartyTransport {
        override val isDemo = false
        override val myUserId: String = sb.currentUserId ?: ""
        private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        override val clock = ClockOffsetEstimator()
        private val _party = MutableStateFlow<Party?>(initial)
        override val party = _party.asStateFlow()
        private val _messages = MutableStateFlow<List<PartyMessage>>(emptyList())
        override val messages = _messages.asStateFlow()
        private val _members = MutableStateFlow<List<PartyMember>>(emptyList())
        override val members = _members.asStateFlow()
        private val _online = MutableStateFlow<Set<String>>(emptySet())
        override val online = _online.asStateFlow()
        private val _reactions = MutableStateFlow<List<Reaction>>(emptyList())
        override val reactions = _reactions.asStateFlow()

        // Mismo canal que la web (`room:<id>`): reacciones y presencia se comparten entre web y app.
        private val channel = realtime.channel(
            topic = "room:${initial.id}",
            postgres = listOf(
                PostgresSubscription("UPDATE", "watch_party_rooms", "id=eq.${initial.id}"),
                PostgresSubscription("INSERT", "watch_party_messages", "room_id=eq.${initial.id}"),
                PostgresSubscription("*", "watch_party_participants", "room_id=eq.${initial.id}"),
            ),
            presenceKey = myUserId,
        )
        override val connection: StateFlow<ConnectionState> = channel.state

        private fun applyRoom(r: RoomRow) { _party.value = r.toParty(_party.value?.animeCover ?: initial.animeCover) }

        init {
            channel.connect()
            scope.launch {
                channel.events.collect { e ->
                    when (e) {
                        is RealtimeEvent.Joined -> {
                            channel.track(buildJsonObject { put("at", System.currentTimeMillis()) })
                            refresh() // recuperar lo que se perdió mientras estaba desconectado
                        }
                        is RealtimeEvent.PostgresChange -> when (e.table) {
                            "watch_party_rooms" -> e.record?.let { r -> runCatching { json.decodeFromJsonElement(RoomRow.serializer(), r) }.getOrNull()?.let(::applyRoom) }
                            "watch_party_messages" -> e.record?.let { r ->
                                runCatching { json.decodeFromJsonElement(RoomMessageRow.serializer(), r) }.getOrNull()?.let { m ->
                                    _messages.update { (it + m.toMessage()).distinctBy { x -> x.id }.takeLast(200) }
                                }
                            }
                            "watch_party_participants" -> loadMembers()
                        }
                        is RealtimeEvent.PresenceState -> _online.value = e.state.keys
                        is RealtimeEvent.PresenceDiff -> _online.update { it + e.joins.keys - e.leaves.keys }
                        is RealtimeEvent.Broadcast -> if (e.event == "reaction") {
                            val emoji = e.payload.str("emoji")
                            val uid = e.payload.str("from") ?: e.payload.str("user_id") ?: ""
                            if (emoji != null && PartyReactions.isAllowed(emoji)) addReaction(Reaction(emoji, uid, System.currentTimeMillis()))
                        }
                        is RealtimeEvent.Disconnected -> Unit
                    }
                }
            }
            scope.launch {
                repeat(5) { sampleClock(); delay(400) }
                while (isActive) {
                    delay(30_000)
                    sampleClock()
                    loadMembers()
                }
            }
        }

        private suspend fun sampleClock() {
            runCatching {
                val t0 = System.currentTimeMillis()
                val raw = sb.rpc("server_time").trim().trim('"')
                val t1 = System.currentTimeMillis()
                clock.addSample(t0, parseIsoMillis(raw), t1)
            }
        }

        private suspend fun refresh() {
            runCatching { sb.select("watch_party_rooms", "id=eq.${initial.id}&select=$ROOM_COLS", roomSer).firstOrNull()?.let(::applyRoom) }
            runCatching {
                _messages.value = sb.select(
                    "watch_party_messages", "room_id=eq.${initial.id}&select=id,room_id,user_id,body,created_at&order=created_at.desc&limit=100",
                    ListSerializer(RoomMessageRow.serializer()),
                ).reversed().map { it.toMessage() }
            }
            loadMembers()
        }

        private suspend fun loadMembers() {
            runCatching {
                _members.value = sb.select(
                    "watch_party_participants", "room_id=eq.${initial.id}&left_at=is.null&select=user_id,joined_at,left_at,profile:profiles(*)",
                    ListSerializer(ParticipantRow.serializer()),
                ).map { PartyMember(it.userId, it.joinedAt, it.profile) }
            }
        }

        /** Solo el anfitrión controla la sala, con la misma función del servidor que usa la web. */
        override suspend fun updateState(playing: Boolean, positionMs: Long, rate: Float, episode: Int): Outcome<Unit> = outcomeOf {
            sb.rpc("watch_party_control", mapOf(
                "room" to initial.id, "playing" to playing, "pos" to positionMs / 1000.0,
                "episode" to episode.toString(), "rate" to rate,
            ).toJsonBody())
            _party.update { it?.copy(isPlaying = playing, positionMs = positionMs, playbackRate = rate, episode = episode, stateUpdatedAt = Instant.ofEpochMilli(serverNow()).toString()) }
        }

        override suspend fun sendChat(text: String): Outcome<Unit> = outcomeOf {
            val body = SafeRichText.sanitizeUserInput(text, 500)
            if (body.isEmpty()) return@outcomeOf
            sb.insert("watch_party_messages", mapOf("room_id" to initial.id, "user_id" to myUserId, "body" to body).toJsonBody(), returning = false)
            Unit
        }

        override fun react(emoji: String) {
            if (!PartyReactions.isAllowed(emoji)) return
            addReaction(Reaction(emoji, myUserId, System.currentTimeMillis()))
            channel.broadcast("reaction", buildJsonObject { put("emoji", emoji); put("from", myUserId) })
        }

        private fun addReaction(r: Reaction) = _reactions.update { (it + r).filter { x -> r.at - x.at < 4_000 }.takeLast(30) }

        override suspend fun invite(friendId: String): Outcome<Unit> = outcomeOf {
            sb.insert("watch_party_invites", mapOf("room_id" to initial.id, "user_id" to friendId, "invited_by" to myUserId).toJsonBody(), returning = false)
            Unit
        }

        /** Igual que la web: al salir el anfitrión, si no queda nadie más, la sala se cierra. */
        override suspend fun leave() {
            runCatching {
                sb.update("watch_party_participants", "room_id=eq.${initial.id}&user_id=eq.$myUserId", mapOf("left_at" to Instant.now().toString()).toJsonBody())
                if (_party.value?.hostId == myUserId) {
                    val others = sb.select(
                        "watch_party_participants", "room_id=eq.${initial.id}&left_at=is.null&user_id=neq.$myUserId&select=user_id",
                        ListSerializer(ParticipantRow.serializer()),
                    )
                    if (others.isEmpty()) sb.update("watch_party_rooms", "id=eq.${initial.id}", mapOf("ended_at" to Instant.now().toString(), "is_playing" to false).toJsonBody())
                }
            }
            close()
        }

        override fun close() { channel.close(); scope.cancel() }
    }
}

/**
 * Single-device demo room used when no backend is configured or the user is a guest.
 * It runs the same sync engine against an in-memory "server" so the mechanics can be
 * tried honestly — the UI labels it "Local demo — not connected to anyone".
 */
class LocalDemoPartyTransport(anime: Party) : PartyTransport {
    override val isDemo = true
    override val myUserId = "local-you"
    override val clock = ClockOffsetEstimator().apply { val t = System.currentTimeMillis(); addSample(t, t, t) }
    private val _party = MutableStateFlow<Party?>(anime.copy(hostId = myUserId))
    override val party = _party.asStateFlow()
    private val _messages = MutableStateFlow(listOf(PartyMessage("sys", anime.id, "system", "system", "Local demo room. Sign in with a configured KAZE backend to invite friends.", Instant.now().toString())))
    override val messages = _messages.asStateFlow()
    override val members = MutableStateFlow(listOf(PartyMember(myUserId, Instant.now().toString(), Profile(myUserId, "you", "You")))).asStateFlow()
    override val online = MutableStateFlow(setOf(myUserId)).asStateFlow()
    private val _reactions = MutableStateFlow<List<Reaction>>(emptyList())
    override val reactions = _reactions.asStateFlow()
    override val connection = MutableStateFlow(ConnectionState.CONNECTED).asStateFlow()

    override suspend fun updateState(playing: Boolean, positionMs: Long, rate: Float, episode: Int): Outcome<Unit> {
        _party.update { it?.copy(isPlaying = playing, positionMs = positionMs, playbackRate = rate, episode = episode, stateUpdatedAt = Instant.now().toString()) }
        return Outcome.Success(Unit)
    }

    override suspend fun sendChat(text: String): Outcome<Unit> {
        val body = SafeRichText.sanitizeUserInput(text, 500)
        if (body.isNotEmpty()) _messages.update { it + PartyMessage(UUID.randomUUID().toString(), "local", myUserId, "chat", body, Instant.now().toString()) }
        return Outcome.Success(Unit)
    }

    override fun react(emoji: String) {
        if (!PartyReactions.isAllowed(emoji)) return
        val now = System.currentTimeMillis()
        _reactions.update { (it + Reaction(emoji, myUserId, now)).filter { x -> now - x.at < 4_000 } }
    }

    override suspend fun invite(friendId: String): Outcome<Unit> = Outcome.Failure(KazeError.NotConfigured)
    override suspend fun leave() = Unit
    override fun close() = Unit
}
