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

@Singleton
class PartyRepository @Inject constructor(
    private val sb: SupabaseClient,
    private val realtime: RealtimeClient,
    private val json: Json,
) {
    val isAvailable get() = sb.config.isConfigured && sb.currentUserId != null
    private val partySer = Party.serializer()

    suspend fun create(animeId: Int, title: String, cover: String?, episode: Int): Outcome<Party> = outcomeOf {
        sb.rpc("create_party", mapOf("p_anime_id" to animeId, "p_title" to title, "p_cover" to cover, "p_episode" to episode).toJsonBody(), partySer)
    }

    suspend fun join(code: String): Outcome<Party> = outcomeOf {
        val clean = code.trim().uppercase().filter { it.isLetterOrDigit() }
        if (clean.length != 6) throw KazeException(KazeError.Validation("Room codes are 6 characters."))
        sb.rpc("join_party", mapOf("p_code" to clean).toJsonBody(), partySer)
    }

    suspend fun myParties(): Outcome<List<Party>> = outcomeOf {
        val now = Instant.now().toString()
        sb.select("watch_parties", "ended_at=is.null&expires_at=gt.$now&select=*&order=created_at.desc&limit=20", ListSerializer(partySer))
    }

    /** Opens the realtime room. Media is resolved by each member's own player — never relayed. */
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

        private val channel = realtime.channel(
            topic = "party:${initial.id}",
            postgres = listOf(
                PostgresSubscription("UPDATE", "watch_parties", "id=eq.${initial.id}"),
                PostgresSubscription("INSERT", "party_messages", "party_id=eq.${initial.id}"),
            ),
            presenceKey = myUserId,
        )
        override val connection: StateFlow<ConnectionState> = channel.state

        init {
            channel.connect()
            scope.launch {
                channel.events.collect { e ->
                    when (e) {
                        is RealtimeEvent.Joined -> {
                            channel.track(buildJsonObject { put("user_id", myUserId); put("online_at", System.currentTimeMillis()) })
                            refresh() // recover anything missed while disconnected
                        }
                        is RealtimeEvent.PostgresChange -> when (e.table) {
                            "watch_parties" -> e.record?.let { r -> runCatching { json.decodeFromJsonElement(partySer, r) }.getOrNull()?.let { _party.value = it } }
                            "party_messages" -> e.record?.let { r -> runCatching { json.decodeFromJsonElement(PartyMessage.serializer(), r) }.getOrNull()?.let { m -> _messages.update { (it + m).distinctBy { x -> x.id }.takeLast(200) } } }
                        }
                        is RealtimeEvent.PresenceState -> _online.value = e.state.keys
                        is RealtimeEvent.PresenceDiff -> _online.update { it + e.joins.keys - e.leaves.keys }
                        is RealtimeEvent.Broadcast -> if (e.event == "reaction") {
                            val emoji = e.payload.str("emoji")
                            val uid = e.payload.str("user_id")
                            if (emoji != null && uid != null && PartyReactions.isAllowed(emoji)) addReaction(Reaction(emoji, uid, System.currentTimeMillis()))
                        }
                        is RealtimeEvent.Disconnected -> Unit
                    }
                }
            }
            // Clock sync burst, then a slow refresh; heartbeat keeps membership alive for host hand-off.
            scope.launch {
                repeat(5) { sampleClock(); delay(400) }
                while (isActive) {
                    delay(20_000)
                    sampleClock()
                    runCatching { sb.rpc("party_heartbeat", mapOf("p_party" to initial.id).toJsonBody()) }
                    loadMembers()
                }
            }
        }

        private suspend fun sampleClock() {
            runCatching {
                val t0 = System.currentTimeMillis()
                val raw = sb.rpc("server_now").trim().trim('"')
                val t1 = System.currentTimeMillis()
                clock.addSample(t0, parseIsoMillis(raw), t1)
            }
        }

        private suspend fun refresh() {
            runCatching { sb.select("watch_parties", "id=eq.${initial.id}&select=*", ListSerializer(partySer)).firstOrNull()?.let { _party.value = it } }
            runCatching {
                _messages.value = sb.select("party_messages", "party_id=eq.${initial.id}&select=*&order=created_at.desc&limit=60", ListSerializer(PartyMessage.serializer())).reversed()
            }
            loadMembers()
        }

        private suspend fun loadMembers() {
            runCatching {
                _members.value = sb.select("party_members", "party_id=eq.${initial.id}&select=user_id,joined_at,profile:profiles!party_members_user_id_fkey(*)", ListSerializer(PartyMember.serializer()))
            }
        }

        override suspend fun updateState(playing: Boolean, positionMs: Long, rate: Float, episode: Int): Outcome<Unit> = outcomeOf {
            val p = sb.rpc("party_update_state", mapOf("p_party" to initial.id, "p_playing" to playing, "p_position" to positionMs, "p_rate" to rate, "p_episode" to episode).toJsonBody(), partySer)
            _party.value = p
        }

        override suspend fun sendChat(text: String): Outcome<Unit> = outcomeOf {
            val body = SafeRichText.sanitizeUserInput(text, 500)
            if (body.isEmpty()) return@outcomeOf
            sb.insert("party_messages", mapOf("party_id" to initial.id, "user_id" to myUserId, "kind" to "chat", "body" to body).toJsonBody(), returning = false)
            Unit
        }

        override fun react(emoji: String) {
            if (!PartyReactions.isAllowed(emoji)) return
            addReaction(Reaction(emoji, myUserId, System.currentTimeMillis()))
            channel.broadcast("reaction", buildJsonObject { put("emoji", emoji); put("user_id", myUserId) })
        }

        private fun addReaction(r: Reaction) = _reactions.update { (it + r).filter { x -> r.at - x.at < 4_000 }.takeLast(30) }

        override suspend fun invite(friendId: String): Outcome<Unit> = outcomeOf {
            sb.rpc("invite_to_party", mapOf("p_party" to initial.id, "p_friend" to friendId).toJsonBody()); Unit
        }

        override suspend fun leave() { runCatching { sb.rpc("leave_party", mapOf("p_party" to initial.id).toJsonBody()) }; close() }

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
