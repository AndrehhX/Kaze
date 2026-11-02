package com.kaze.mobile.core.common

import java.io.IOException

/** Domain-level error taxonomy shown to users as clear messages. */
sealed class KazeError(val userMessage: String) {
    data object Offline : KazeError("No connection. Showing what's saved on this device.")
    data class RateLimited(val retryAfterSeconds: Long?) : KazeError("AniList is rate-limiting requests. Trying again shortly.")
    data class Server(val code: Int?, val detail: String?) : KazeError("The server had a problem${code?.let { " ($it)" } ?: ""}. Please try again.")
    data object Unauthorized : KazeError("Your session expired. Please sign in again.")
    data object NotConfigured : KazeError("This feature needs a KAZE backend. See Settings → Connected accounts.")
    data class Validation(val detail: String) : KazeError(detail)
    data class NotFound(val what: String) : KazeError("$what could not be found.")
    data class Unknown(val cause: Throwable?) : KazeError(cause?.message ?: "Unexpected error.")
}

class KazeException(val error: KazeError) : Exception(error.userMessage)

sealed interface Outcome<out T> {
    data class Success<T>(val value: T) : Outcome<T>
    data class Failure(val error: KazeError) : Outcome<Nothing>
}

inline fun <T> Outcome<T>.onSuccess(block: (T) -> Unit): Outcome<T> { if (this is Outcome.Success) block(value); return this }
inline fun <T> Outcome<T>.onFailure(block: (KazeError) -> Unit): Outcome<T> { if (this is Outcome.Failure) block(error); return this }
fun <T> Outcome<T>.getOrNull(): T? = (this as? Outcome.Success)?.value

fun Throwable.toKazeError(): KazeError = when (this) {
    is KazeException -> error
    is java.net.UnknownHostException, is java.net.ConnectException, is java.net.SocketTimeoutException -> KazeError.Offline
    is retrofit2.HttpException -> when (code()) {
        401, 403 -> KazeError.Unauthorized
        404 -> KazeError.NotFound("That item")
        429 -> KazeError.RateLimited(response()?.headers()?.get("Retry-After")?.toLongOrNull())
        else -> KazeError.Server(code(), message())
    }
    is IOException -> KazeError.Offline
    else -> KazeError.Unknown(this)
}

suspend fun <T> outcomeOf(block: suspend () -> T): Outcome<T> = try {
    Outcome.Success(block())
} catch (c: kotlinx.coroutines.CancellationException) {
    throw c
} catch (t: Throwable) {
    Outcome.Failure(t.toKazeError())
}

/** UI-friendly loading state that can carry stale data while refreshing. */
data class Loadable<out T>(
    val data: T? = null,
    val loading: Boolean = false,
    val error: KazeError? = null,
    val stale: Boolean = false,
)
