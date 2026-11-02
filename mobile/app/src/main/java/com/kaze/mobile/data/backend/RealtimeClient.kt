package com.kaze.mobile.data.backend

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.atomic.AtomicInteger
import javax.inject.Inject
import javax.inject.Singleton

sealed interface RealtimeEvent {
    data object Joined : RealtimeEvent
    data class Disconnected(val reason: String?) : RealtimeEvent
    data class PostgresChange(val table: String, val type: String, val record: JsonObject?, val oldRecord: JsonObject?) : RealtimeEvent
    data class PresenceState(val state: JsonObject) : RealtimeEvent
    data class PresenceDiff(val joins: JsonObject, val leaves: JsonObject) : RealtimeEvent
    data class Broadcast(val event: String, val payload: JsonObject) : RealtimeEvent
}

enum class ConnectionState { CONNECTING, CONNECTED, RECONNECTING, CLOSED }

data class PostgresSubscription(val event: String, val table: String, val filter: String?)

/**
 * Supabase Realtime over the Phoenix channel protocol (one socket per channel).
 * Handles heartbeats, JWT on join, exponential-backoff reconnection and automatic rejoin.
 */
@Singleton
class RealtimeClient @Inject constructor(
    private val http: OkHttpClient,
    private val json: Json,
    private val supabase: SupabaseClient,
) {
    fun channel(topic: String, postgres: List<PostgresSubscription>, presenceKey: String?, broadcastSelf: Boolean = false): RealtimeChannel =
        RealtimeChannel(http, json, supabase, topic, postgres, presenceKey, broadcastSelf)
}

class RealtimeChannel internal constructor(
    private val http: OkHttpClient,
    private val json: Json,
    private val supabase: SupabaseClient,
    private val topic: String,
    private val postgres: List<PostgresSubscription>,
    private val presenceKey: String?,
    private val broadcastSelf: Boolean,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val ref = AtomicInteger(0)
    private var socket: WebSocket? = null
    private var heartbeat: Job? = null
    private var joinRef: String? = null
    private var closedByUser = false
    private var attempt = 0
    private var trackedPresence: JsonObject? = null

    private val _events = MutableSharedFlow<RealtimeEvent>(extraBufferCapacity = 128, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    val events: SharedFlow<RealtimeEvent> = _events.asSharedFlow()
    private val _state = MutableStateFlow(ConnectionState.CONNECTING)
    val state: StateFlow<ConnectionState> = _state.asStateFlow()

    private val fullTopic get() = "realtime:$topic"

    fun connect() {
        closedByUser = false
        scope.launch { open() }
    }

    private suspend fun open() {
        val token = supabase.accessToken()
        val cfg = supabase.config
        val url = "${cfg.realtimeUrl}?apikey=${cfg.anonKey}&vsn=1.0.0"
        val request = Request.Builder().url(url).build()
        socket = http.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                attempt = 0
                join(token)
                startHeartbeat()
            }
            override fun onMessage(webSocket: WebSocket, text: String) = handle(text)
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) = scheduleReconnect(t.message)
            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) { if (!closedByUser) scheduleReconnect(reason) }
        })
    }

    private fun join(token: String?) {
        val r = ref.incrementAndGet().toString()
        joinRef = r
        val config = buildJsonObject {
            put("broadcast", buildJsonObject { put("self", broadcastSelf); put("ack", false) })
            put("presence", buildJsonObject { put("key", presenceKey ?: "") })
            put("postgres_changes", JsonArray(postgres.map { p ->
                buildJsonObject {
                    put("event", p.event); put("schema", "public"); put("table", p.table)
                    if (p.filter != null) put("filter", p.filter)
                }
            }))
        }
        send("phx_join", buildJsonObject {
            put("config", config)
            if (token != null) put("access_token", token)
        }, r, r)
    }

    private fun startHeartbeat() {
        heartbeat?.cancel()
        heartbeat = scope.launch {
            while (isActive) {
                delay(25_000)
                socket?.send(buildJsonObject {
                    put("topic", "phoenix"); put("event", "heartbeat"); put("payload", JsonObject(emptyMap())); put("ref", ref.incrementAndGet().toString())
                }.toString())
            }
        }
    }

    private fun handle(text: String) {
        val msg = runCatching { json.parseToJsonElement(text).jsonObject }.getOrNull() ?: return
        val event = msg["event"]?.jsonPrimitive?.contentOrNull ?: return
        val payload = msg["payload"] as? JsonObject ?: JsonObject(emptyMap())
        when (event) {
            "phx_reply" -> if (msg["ref"]?.jsonPrimitive?.contentOrNull == joinRef) {
                val ok = payload["status"]?.jsonPrimitive?.contentOrNull == "ok"
                if (ok) {
                    _state.value = ConnectionState.CONNECTED
                    _events.tryEmit(RealtimeEvent.Joined)
                    trackedPresence?.let { track(it) }
                } else _events.tryEmit(RealtimeEvent.Disconnected("Join refused: $payload"))
            }
            "postgres_changes" -> {
                val data = payload["data"] as? JsonObject ?: return
                _events.tryEmit(RealtimeEvent.PostgresChange(
                    table = data["table"]?.jsonPrimitive?.contentOrNull ?: return,
                    type = data["type"]?.jsonPrimitive?.contentOrNull ?: "",
                    record = data["record"] as? JsonObject,
                    oldRecord = data["old_record"] as? JsonObject,
                ))
            }
            "presence_state" -> _events.tryEmit(RealtimeEvent.PresenceState(payload))
            "presence_diff" -> _events.tryEmit(RealtimeEvent.PresenceDiff(payload["joins"] as? JsonObject ?: JsonObject(emptyMap()), payload["leaves"] as? JsonObject ?: JsonObject(emptyMap())))
            "broadcast" -> {
                val name = payload["event"]?.jsonPrimitive?.contentOrNull ?: return
                _events.tryEmit(RealtimeEvent.Broadcast(name, payload["payload"] as? JsonObject ?: JsonObject(emptyMap())))
            }
            "phx_error", "phx_close" -> scheduleReconnect(event)
        }
    }

    private fun scheduleReconnect(reason: String?) {
        if (closedByUser) return
        heartbeat?.cancel()
        _state.value = ConnectionState.RECONNECTING
        _events.tryEmit(RealtimeEvent.Disconnected(reason))
        val wait = (1_000L shl attempt.coerceAtMost(5)).coerceAtMost(30_000L)
        attempt++
        scope.launch { delay(wait); if (!closedByUser) open() }
    }

    fun broadcast(event: String, payload: JsonObject) {
        send("broadcast", buildJsonObject { put("type", "broadcast"); put("event", event); put("payload", payload) })
    }

    fun track(meta: JsonObject) {
        trackedPresence = meta
        send("presence", buildJsonObject { put("type", "presence"); put("event", "track"); put("payload", meta) })
    }

    private fun send(event: String, payload: JsonElement, ref: String = this.ref.incrementAndGet().toString(), jRef: String? = joinRef) {
        socket?.send(buildJsonObject {
            put("topic", fullTopic); put("event", event); put("payload", payload); put("ref", ref)
            if (jRef != null) put("join_ref", jRef)
        }.toString())
    }

    fun close() {
        closedByUser = true
        runCatching { send("phx_leave", JsonObject(emptyMap())) }
        socket?.close(1000, "bye")
        socket = null
        _state.value = ConnectionState.CLOSED
        scope.cancel()
    }
}

fun JsonObject.str(key: String): String? = (this[key] as? JsonPrimitive)?.contentOrNull
fun JsonObject.long(key: String): Long? = (this[key] as? JsonPrimitive)?.contentOrNull?.toDoubleOrNull()?.toLong()
fun JsonObject.bool(key: String): Boolean? = (this[key] as? JsonPrimitive)?.contentOrNull?.toBooleanStrictOrNull()
fun JsonObject.float(key: String): Float? = (this[key] as? JsonPrimitive)?.contentOrNull?.toFloatOrNull()
