package com.kaze.mobile.feature.update

import android.content.Intent
import android.net.Uri
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.window.DialogProperties
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.kaze.mobile.BuildConfig
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.data.anilist.await
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.CacheControl
import okhttp3.OkHttpClient
import okhttp3.Request
import javax.inject.Inject

/**
 * Archivo publicado junto a la APK en la VPS (www.orunei.sbs/app-version.json).
 * Para avisar de una versión nueva basta con subir la APK y aumentar `versionCode` aquí.
 */
@Serializable
data class AppVersionInfo(
    val versionCode: Int,
    val versionName: String = "",
    val url: String = "https://www.orunei.sbs/kaze.apk",
    val notes: String = "",
    /** Versiones por debajo de este número no pueden seguir usándose: el aviso no se puede cerrar. */
    val minVersionCode: Int = 0,
)

@HiltViewModel
class UpdateViewModel @Inject constructor(private val http: OkHttpClient, private val json: Json) : ViewModel() {
    private val _available = MutableStateFlow<AppVersionInfo?>(null)
    val available: StateFlow<AppVersionInfo?> = _available.asStateFlow()

    init {
        viewModelScope.launch {
            val info = runCatching {
                withContext(Dispatchers.IO) {
                    // El parámetro `t` evita la caché de Cloudflare (que guarda este archivo varias horas).
                    val req = Request.Builder().url("$VERSION_URL?t=${System.currentTimeMillis() / 60_000}").cacheControl(CacheControl.FORCE_NETWORK).build()
                    http.newCall(req).await().use { res -> if (res.isSuccessful) json.decodeFromString(AppVersionInfo.serializer(), res.body!!.string()) else null }
                }
            }.getOrNull()
            if (info != null && info.versionCode > BuildConfig.VERSION_CODE) _available.value = info
        }
    }

    fun dismiss() { _available.value = null }

    companion object { const val VERSION_URL = "https://www.orunei.sbs/app-version.json" }
}

/** Aviso al abrir la app cuando hay una versión más nueva publicada en la web. */
@Composable
fun UpdatePrompt(vm: UpdateViewModel = hiltViewModel()) {
    val info by vm.available.collectAsStateWithLifecycle()
    val update = info ?: return
    val context = LocalContext.current
    val required = BuildConfig.VERSION_CODE < update.minVersionCode
    AlertDialog(
        onDismissRequest = { if (!required) vm.dismiss() },
        properties = DialogProperties(dismissOnBackPress = !required, dismissOnClickOutside = !required),
        title = { Text(if (required) "Necesitas actualizar KAZE" else "Nueva versión disponible", style = Kaze.type.title) },
        text = {
            Text(
                buildString {
                    append("Versión ${update.versionName.ifBlank { update.versionCode.toString() }} (tienes la ${BuildConfig.VERSION_NAME}).")
                    if (update.notes.isNotBlank()) append("\n\n").append(update.notes)
                    append("\n\nAl descargarla, ábrela e instálala encima: no pierdes nada.")
                },
                style = Kaze.type.body,
            )
        },
        confirmButton = {
            TextButton({
                runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(update.url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
                if (!required) vm.dismiss()
            }) { Text("Descargar") }
        },
        dismissButton = if (required) null else ({ TextButton(vm::dismiss) { Text("Más tarde") } }),
    )
}
