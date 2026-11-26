package com.kaze.mobile.core.common

import java.io.IOException

/** Domain-level error taxonomy shown to users as clear messages. */
sealed class KazeError(val userMessage: String) {
    data object Offline : KazeError("Sin conexión. Te mostramos lo que hay guardado en el teléfono.")
    data class RateLimited(val retryAfterSeconds: Long?) : KazeError("AniList recibió muchas peticiones. Lo intentamos de nuevo en un momento.")
    data class Server(val code: Int?, val detail: String?) : KazeError("El servidor tuvo un problema${code?.let { " ($it)" } ?: ""}. Inténtalo de nuevo.")
    data object Unauthorized : KazeError("Tu sesión caducó. Vuelve a iniciar sesión.")
    data object NotConfigured : KazeError("Esta función necesita tu cuenta de KAZE. Ve a Ajustes → Cuenta.")
    data class Validation(val detail: String) : KazeError(detail)
    data class NotFound(val what: String) : KazeError("No se encontró: $what.")
    data class Unknown(val cause: Throwable?) : KazeError(cause?.message ?: "Error inesperado.")
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
