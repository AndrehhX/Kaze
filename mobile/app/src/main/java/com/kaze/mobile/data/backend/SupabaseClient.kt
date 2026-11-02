package com.kaze.mobile.data.backend

import android.util.Base64
import com.kaze.mobile.BuildConfig
import com.kaze.mobile.core.common.KazeError
import com.kaze.mobile.core.common.KazeException
import com.kaze.mobile.core.security.TokenStore
import com.kaze.mobile.data.anilist.await
import com.kaze.mobile.data.anilist.toJsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.security.MessageDigest
import java.security.SecureRandom
import javax.inject.Inject
import javax.inject.Singleton

/** Public client configuration only. The anon key is designed to ship in apps; RLS protects data. */
data class SupabaseConfig(val url: String, val anonKey: String) {
    val isConfigured: Boolean get() = url.startsWith("https://") && anonKey.isNotBlank()
    val realtimeUrl: String get() = url.replaceFirst("https://", "wss://").trimEnd('/') + "/realtime/v1/websocket"

    companion object {
        fun fromBuildConfig() = SupabaseConfig(BuildConfig.SUPABASE_URL.trimEnd('/'), BuildConfig.SUPABASE_ANON_KEY)
    }
}

@Serializable
data class AuthUser(
    val id: String,
    val email: String? = null,
    @SerialName("email_confirmed_at") val emailConfirmedAt: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
)

@Serializable
data class Session(
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String,
    @SerialName("expires_in") val expiresIn: Long = 3600,
    @SerialName("expires_at") val expiresAt: Long? = null,
    val user: AuthUser? = null,
) {
    fun expiresAtEpoch(nowSec: Long): Long = expiresAt ?: (nowSec + expiresIn)
}

@Serializable
private data class StoredSession(val session: Session, val expiresAtEpoch: Long)

sealed interface AuthState {
    data object NotConfigured : AuthState
    data object SignedOut : AuthState
    data class SignedIn(val user: AuthUser, val emailVerified: Boolean) : AuthState
}

/**
 * Minimal, dependency-free Supabase client over HTTPS:
 *  - GoTrue auth (password + PKCE email links, refresh rotation, recovery, sign-out)
 *  - PostgREST queries and RPCs, always with the user's JWT so Row Level Security applies
 * The session is persisted only through [TokenStore] (Android Keystore encryption).
 */
@Singleton
class SupabaseClient @Inject constructor(
    private val http: OkHttpClient,
    private val json: Json,
    private val store: TokenStore,
) {
    val config: SupabaseConfig = SupabaseConfig.fromBuildConfig()
    private val mutex = Mutex()
    private var stored: StoredSession? = null

    private val _auth = MutableStateFlow<AuthState>(if (config.isConfigured) AuthState.SignedOut else AuthState.NotConfigured)
    val auth: StateFlow<AuthState> = _auth.asStateFlow()

    val currentUserId: String? get() = (auth.value as? AuthState.SignedIn)?.user?.id

    init {
        if (config.isConfigured) {
            stored = store.get(KEY_SESSION)?.let { runCatching { json.decodeFromString(StoredSession.serializer(), it) }.getOrNull() }
            stored?.session?.user?.let { _auth.value = AuthState.SignedIn(it, it.emailConfirmedAt != null) }
        }
    }

    private fun requireConfigured() { if (!config.isConfigured) throw KazeException(KazeError.NotConfigured) }

    // ------------------------------------------------------------------ Auth

    suspend fun signUp(email: String, password: String, username: String): Boolean {
        requireConfigured()
        val (verifier, challenge) = newPkce()
        store.put(KEY_PKCE, verifier)
        store.put(KEY_PKCE_PURPOSE, "signup")
        val body = """{"email":${q(email)},"password":${q(password)},"data":{"username":${q(username)}},"code_challenge":${q(challenge)},"code_challenge_method":"s256"}"""
        val res = authCall("signup?redirect_to=$REDIRECT", body)
        // When email confirmation is disabled the response already contains a session.
        val obj = json.parseToJsonElement(res).jsonObject
        if (obj["access_token"] != null) { saveSession(json.decodeFromString(Session.serializer(), res)); return true }
        return false
    }

    suspend fun signIn(email: String, password: String) {
        requireConfigured()
        val res = authCall("token?grant_type=password", """{"email":${q(email)},"password":${q(password)}}""")
        saveSession(json.decodeFromString(Session.serializer(), res))
    }

    suspend fun sendPasswordReset(email: String) {
        requireConfigured()
        val (verifier, challenge) = newPkce()
        store.put(KEY_PKCE, verifier)
        store.put(KEY_PKCE_PURPOSE, "recovery")
        authCall("recover?redirect_to=$REDIRECT", """{"email":${q(email)},"code_challenge":${q(challenge)},"code_challenge_method":"s256"}""")
    }

    suspend fun resendVerification(email: String) {
        requireConfigured()
        authCall("resend?redirect_to=$REDIRECT", """{"type":"signup","email":${q(email)}}""")
    }

    /** Exchanges the one-time PKCE code from an email link for a session; returns what the link was for. */
    suspend fun exchangeCode(code: String): String {
        requireConfigured()
        val verifier = store.get(KEY_PKCE) ?: throw KazeException(KazeError.Validation("This link was opened on a different device or has already been used."))
        val res = authCall("token?grant_type=pkce", """{"auth_code":${q(code)},"code_verifier":${q(verifier)}}""")
        val purpose = store.get(KEY_PKCE_PURPOSE) ?: "signup"
        store.clear(KEY_PKCE, KEY_PKCE_PURPOSE)
        saveSession(json.decodeFromString(Session.serializer(), res))
        return purpose
    }

    /** Legacy implicit links (#access_token=…) — accepted only with a refresh token, then verified against /user. */
    suspend fun acceptFragmentSession(accessToken: String, refreshToken: String, expiresIn: Long) {
        requireConfigured()
        val user = getUser(accessToken)
        saveSession(Session(accessToken, refreshToken, expiresIn, null, user))
    }

    suspend fun updatePassword(newPassword: String) {
        authed("PUT", "/auth/v1/user", """{"password":${q(newPassword)}}""")
    }

    suspend fun refreshUser() {
        val token = accessToken() ?: return
        val user = getUser(token)
        stored = stored?.copy(session = stored!!.session.copy(user = user))
        stored?.let { store.put(KEY_SESSION, json.encodeToString(StoredSession.serializer(), it)) }
        _auth.value = AuthState.SignedIn(user, user.emailConfirmedAt != null)
    }

    suspend fun signOut() {
        val token = stored?.session?.accessToken
        if (token != null) runCatching { request("POST", "/auth/v1/logout", "{}", token) }
        clearSession()
    }

    fun clearSession() {
        stored = null
        store.clear(KEY_SESSION, KEY_PKCE)
        _auth.value = if (config.isConfigured) AuthState.SignedOut else AuthState.NotConfigured
    }

    private suspend fun getUser(token: String): AuthUser =
        json.decodeFromString(AuthUser.serializer(), request("GET", "/auth/v1/user", null, token))

    private fun saveSession(s: Session) {
        val now = System.currentTimeMillis() / 1000
        val st = StoredSession(s, s.expiresAtEpoch(now))
        stored = st
        store.put(KEY_SESSION, json.encodeToString(StoredSession.serializer(), st))
        s.user?.let { _auth.value = AuthState.SignedIn(it, it.emailConfirmedAt != null) }
    }

    /** Returns a valid access token, refreshing (rotation) ~60 s before expiry. */
    suspend fun accessToken(): String? = mutex.withLock {
        val st = stored ?: return@withLock null
        val now = System.currentTimeMillis() / 1000
        if (st.expiresAtEpoch - now > 60) return@withLock st.session.accessToken
        return@withLock try {
            val res = authCall("token?grant_type=refresh_token", """{"refresh_token":${q(st.session.refreshToken)}}""")
            val fresh = json.decodeFromString(Session.serializer(), res)
            saveSession(fresh.copy(user = fresh.user ?: st.session.user))
            fresh.accessToken
        } catch (e: KazeException) {
            if (e.error is KazeError.Unauthorized || e.error is KazeError.Validation) clearSession()
            null
        }
    }

    // ------------------------------------------------------------------ PostgREST

    suspend fun <T> select(table: String, query: String, serializer: KSerializer<T>): T =
        json.decodeFromString(serializer, authed("GET", "/rest/v1/$table?$query", null))

    suspend fun insert(table: String, body: String, returning: Boolean = true, upsert: Boolean = false): String =
        authed("POST", "/rest/v1/$table", body, prefer = buildString {
            append(if (returning) "return=representation" else "return=minimal")
            if (upsert) append(",resolution=merge-duplicates")
        })

    suspend fun update(table: String, filter: String, body: String): String =
        authed("PATCH", "/rest/v1/$table?$filter", body, prefer = "return=representation")

    suspend fun delete(table: String, filter: String) { authed("DELETE", "/rest/v1/$table?$filter", null) }

    suspend fun rpc(fn: String, body: String = "{}"): String = authed("POST", "/rest/v1/rpc/$fn", body)

    suspend fun <T> rpc(fn: String, body: String, serializer: KSerializer<T>): T = json.decodeFromString(serializer, rpc(fn, body))

    private suspend fun authed(method: String, path: String, body: String?, prefer: String? = null): String {
        requireConfigured()
        val token = accessToken() ?: throw KazeException(KazeError.Unauthorized)
        return request(method, path, body, token, prefer)
    }

    private suspend fun authCall(path: String, body: String): String = request("POST", "/auth/v1/$path", body, null)

    private suspend fun request(method: String, path: String, body: String?, bearer: String?, prefer: String? = null): String = withContext(Dispatchers.IO) {
        val url = (config.url + path).toHttpUrl()
        val req = Request.Builder().url(url)
            .header("apikey", config.anonKey)
            .header("Authorization", "Bearer ${bearer ?: config.anonKey}")
            .header("Accept", "application/json")
            .apply { if (prefer != null) header("Prefer", prefer) }
            .method(method, body?.toRequestBody(JSON_TYPE) ?: if (method == "GET" || method == "DELETE") null else "{}".toRequestBody(JSON_TYPE))
            .build()
        http.newCall(req).await().use { res ->
            val text = res.body?.string().orEmpty()
            if (!res.isSuccessful) throw KazeException(mapError(res.code, text))
            text
        }
    }

    private fun mapError(code: Int, body: String): KazeError {
        val msg = runCatching {
            val o = json.parseToJsonElement(body).jsonObject
            (o["msg"] ?: o["message"] ?: o["error_description"] ?: o["error"])?.jsonPrimitive?.content
        }.getOrNull()
        return when (code) {
            400, 422 -> KazeError.Validation(friendly(msg) ?: "Please check what you entered.")
            401, 403 -> if (msg?.contains("Email not confirmed", true) == true) KazeError.Validation("Please confirm your email first — check your inbox.") else KazeError.Unauthorized
            404 -> KazeError.NotFound("That item")
            409 -> KazeError.Validation(friendly(msg) ?: "That already exists.")
            429 -> KazeError.RateLimited(null)
            else -> KazeError.Server(code, msg)
        }
    }

    private fun friendly(msg: String?): String? = when {
        msg == null -> null
        msg.contains("Invalid login credentials", true) -> "Email or password is incorrect."
        msg.contains("already registered", true) -> "An account with this email already exists."
        msg.contains("duplicate key", true) && msg.contains("username", true) -> "That username is taken."
        msg.contains("Password should be", true) -> msg
        else -> msg
    }

    private fun q(s: String): String = json.encodeToString(JsonElement.serializer(), kotlinx.serialization.json.JsonPrimitive(s))

    companion object {
        private const val KEY_SESSION = "supabase_session"
        private const val KEY_PKCE = "supabase_pkce_verifier"
        private const val KEY_PKCE_PURPOSE = "supabase_pkce_purpose"
        const val REDIRECT = "kaze://auth-callback"
        private val JSON_TYPE = "application/json; charset=utf-8".toMediaType()

        fun newPkce(): Pair<String, String> {
            val bytes = ByteArray(48).also { SecureRandom().nextBytes(it) }
            val verifier = Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
            val digest = MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray(Charsets.US_ASCII))
            val challenge = Base64.encodeToString(digest, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
            return verifier to challenge
        }
    }
}

/** Builds a PostgREST JSON body from a map without reflection. */
fun Map<String, Any?>.toJsonBody(): String = toJsonObject().toString()
