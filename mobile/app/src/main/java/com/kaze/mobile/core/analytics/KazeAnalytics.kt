package com.kaze.mobile.core.analytics

import android.content.Context
import android.os.Build
import android.util.Log
import com.kaze.mobile.BuildConfig
import com.kaze.mobile.core.datastore.UserPreferencesRepository
import com.kaze.mobile.data.anilist.toJsonObject
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.Locale
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Estadísticas anónimas con Umami (el mismo panel que la web, sin cookies ni datos personales).
 * La app se ve en Umami con el dominio "app.kaze" para separarla de la web.
 * Se puede apagar en Ajustes → Más → Estadísticas anónimas.
 */
@Singleton
class KazeAnalytics @Inject constructor(
    @ApplicationContext private val context: Context,
    private val prefs: UserPreferencesRepository,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    // Cliente propio: Umami usa el User-Agent para saber sistema y dispositivo (sin el interceptor de la app).
    private val http = OkHttpClient.Builder().connectTimeout(10, TimeUnit.SECONDS).readTimeout(10, TimeUnit.SECONDS).build()
    private val userAgent = "Mozilla/5.0 (Linux; Android ${Build.VERSION.RELEASE}; ${Build.MODEL}) KAZEApp/${BuildConfig.VERSION_NAME} Mobile"
    private val screen = context.resources.displayMetrics.let { "${it.widthPixels}x${it.heightPixels}" }
    private val language = Locale.getDefault().toLanguageTag()
    private var lastPath: String? = null

    /** Una "visita" a una pantalla, p. ej. "/anime/154587". */
    fun screen(path: String, title: String) {
        if (path == lastPath) return
        lastPath = path
        send(path, title, name = null, data = null)
    }

    /** Un evento con datos, p. ej. episodio_reproducido {anime, episodio}. */
    fun event(name: String, data: Map<String, Any?> = emptyMap()) = send(lastPath ?: "/", name, name, data)

    private fun send(path: String, title: String, name: String?, data: Map<String, Any?>?) {
        scope.launch {
            if (!runCatching { prefs.prefs.first().analyticsEnabled }.getOrDefault(true)) return@launch
            val payload = buildMap<String, Any?> {
                put("website", WEBSITE_ID)
                put("hostname", HOSTNAME)
                put("url", path)
                put("title", title)
                put("language", language)
                put("screen", screen)
                put("referrer", "")
                if (name != null) put("name", name)
                if (!data.isNullOrEmpty()) put("data", data.filterValues { it != null })
            }
            val body = mapOf("type" to "event", "payload" to payload).toJsonObject().toString()
            runCatching {
                http.newCall(
                    Request.Builder().url(ENDPOINT)
                        .header("User-Agent", userAgent)
                        .post(body.toRequestBody("application/json".toMediaType()))
                        .build()
                ).execute().close()
            }.onFailure { Log.d("KazeAnalytics", "No se pudo enviar: ${it.message}") }
        }
    }

    private companion object {
        const val ENDPOINT = "https://cloud.umami.is/api/send"
        // ID público del sitio en Umami (el mismo que sale en el HTML de orunei.sbs).
        const val WEBSITE_ID = "31796195-3274-487b-afe7-0a9bc1992198"
        const val HOSTNAME = "app.kaze"
    }
}
