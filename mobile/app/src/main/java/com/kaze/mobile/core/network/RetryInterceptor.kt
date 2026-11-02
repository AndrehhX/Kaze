package com.kaze.mobile.core.network

import okhttp3.Interceptor
import okhttp3.Response
import java.io.IOException

/**
 * Bounded retry with exponential backoff for idempotent-ish GraphQL reads.
 * - 429: honours Retry-After (capped) — AniList enforces a per-minute budget.
 * - 5xx / transient IO: 2 retries, 600ms → 1.8s.
 * Never retries 4xx other than 429, and never more than [maxRetries] times.
 */
class RetryInterceptor(
    private val maxRetries: Int = 2,
    private val baseDelayMs: Long = 600,
    private val maxRetryAfterSeconds: Long = 20,
    private val sleeper: (Long) -> Unit = { Thread.sleep(it) },
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        var attempt = 0
        var lastError: IOException? = null
        while (true) {
            val response = try {
                chain.proceed(chain.request())
            } catch (e: IOException) {
                lastError = e
                null
            }
            if (response != null) {
                val retryable = response.code == 429 || response.code in 500..599
                if (!retryable || attempt >= maxRetries) return response
                val wait = if (response.code == 429) {
                    (response.header("Retry-After")?.toLongOrNull() ?: 2L).coerceAtMost(maxRetryAfterSeconds) * 1000
                } else backoff(attempt)
                response.close()
                sleeper(wait)
            } else {
                if (attempt >= maxRetries || chain.call().isCanceled()) throw lastError!!
                sleeper(backoff(attempt))
            }
            attempt++
        }
    }

    private fun backoff(attempt: Int): Long {
        var delay = baseDelayMs
        repeat(attempt) { delay *= 3 }
        return delay
    }
}

class UserAgentInterceptor(private val userAgent: String) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response =
        chain.proceed(chain.request().newBuilder().header("User-Agent", userAgent).build())
}
