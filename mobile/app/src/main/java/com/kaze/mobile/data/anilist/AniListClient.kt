package com.kaze.mobile.data.anilist

import com.kaze.mobile.core.common.KazeError
import com.kaze.mobile.core.common.KazeException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/** Raw result: the decoded data plus its JSON so repositories can cache it verbatim. */
data class GraphQlResult<T>(val data: T, val raw: JsonElement)

@Singleton
class AniListClient @Inject constructor(
    private val http: OkHttpClient,
    private val json: Json,
    @Named("anilistEndpoint") private val endpoint: String,
) {
    suspend fun <T> execute(
        query: String,
        variables: Map<String, Any?>,
        serializer: KSerializer<T>,
        token: String? = null,
    ): GraphQlResult<T> = withContext(Dispatchers.IO) {
        // AniList treats an explicit null very differently from an absent variable
        // (e.g. `season: null` filters to no-season titles, `averageScore_greater: null` is a 400),
        // so unset filters are omitted entirely.
        val body = json.encodeToString(GraphQlRequest.serializer(), GraphQlRequest(query, variables.filterValues { it != null }.toJsonObject()))
        val request = Request.Builder()
            .url(endpoint)
            .post(body.toRequestBody(JSON))
            .header("Accept", "application/json")
            .apply { if (token != null) header("Authorization", "Bearer $token") }
            .build()
        val response = http.newCall(request).await()
        response.use { res ->
            val text = res.body?.string().orEmpty()
            val root = runCatching { json.parseToJsonElement(text).jsonObject }.getOrNull()
                ?: throw KazeException(errorFor(res.code, null, res.header("Retry-After")))
            val errors = root["errors"]?.let { runCatching { json.decodeFromJsonElement(kotlinx.serialization.builtins.ListSerializer(GraphQlError.serializer()), it) }.getOrNull() }
            val data = root["data"]
            if (!res.isSuccessful || data == null || data is JsonNull) {
                throw KazeException(errorFor(res.code, errors?.firstOrNull(), res.header("Retry-After")))
            }
            GraphQlResult(json.decodeFromJsonElement(serializer, data), data)
        }
    }

    fun <T> decode(raw: JsonElement, serializer: KSerializer<T>): T = json.decodeFromJsonElement(serializer, raw)

    private fun errorFor(code: Int, error: GraphQlError?, retryAfter: String?): KazeError {
        val status = error?.status ?: code
        return when (status) {
            400 -> KazeError.Validation(error?.message ?: "Invalid request")
            401, 403 -> KazeError.Unauthorized
            404 -> KazeError.NotFound("That anime")
            429 -> KazeError.RateLimited(retryAfter?.toLongOrNull())
            else -> KazeError.Server(status, error?.message)
        }
    }

    companion object {
        private val JSON = "application/json; charset=utf-8".toMediaType()
    }
}

fun Map<String, Any?>.toJsonObject(): JsonObject = JsonObject(mapValues { (_, v) -> v.toJsonElement() })

private fun Any?.toJsonElement(): JsonElement = when (this) {
    null -> JsonNull
    is JsonElement -> this
    is String -> JsonPrimitive(this)
    is Number -> JsonPrimitive(this)
    is Boolean -> JsonPrimitive(this)
    is Enum<*> -> JsonPrimitive(name)
    is Iterable<*> -> JsonArray(map { it.toJsonElement() })
    is Map<*, *> -> JsonObject(entries.associate { it.key.toString() to it.value.toJsonElement() })
    else -> JsonPrimitive(toString())
}

suspend fun Call.await(): Response = suspendCancellableCoroutine { cont ->
    enqueue(object : Callback {
        override fun onResponse(call: Call, response: Response) = cont.resume(response)
        override fun onFailure(call: Call, e: IOException) { if (!cont.isCancelled) cont.resumeWithException(e) }
    })
    cont.invokeOnCancellation { runCatching { cancel() } }
}
