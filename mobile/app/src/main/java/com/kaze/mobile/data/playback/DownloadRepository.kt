package com.kaze.mobile.data.playback

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.NoOpCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.offline.Download
import androidx.media3.exoplayer.offline.DownloadHelper
import androidx.media3.exoplayer.offline.DownloadManager
import androidx.media3.exoplayer.offline.DownloadRequest
import androidx.media3.exoplayer.offline.DownloadService
import androidx.media3.exoplayer.scheduler.Requirements
import com.kaze.mobile.core.common.Outcome
import com.kaze.mobile.core.datastore.UserPreferencesRepository
import com.kaze.mobile.domain.playback.MediaProvider
import com.kaze.mobile.domain.playback.SideloadedSubtitle
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import com.kaze.mobile.data.anilist.await
import java.io.File
import java.io.IOException
import java.util.concurrent.Executors
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/** PAUSED = la pausaste tú · WAITING = espera Wi-Fi o conexión para seguir. */
enum class DownloadStatus { QUEUED, DOWNLOADING, PAUSED, WAITING, COMPLETED, FAILED }

data class DownloadedEpisode(
    val id: String, // "$animeId:$episode"
    val animeId: Int,
    val episode: Int,
    val title: String,
    val animeTitle: String,
    val coverUrl: String? = null,
    val bannerUrl: String? = null,
    val totalEpisodes: Int? = null,
    val fileSizeBytes: Long = 0,
    val downloadedAt: Long = System.currentTimeMillis(),
    val audioOption: String = "sub", // "sub" o "latino"
    val quality: Int = 720,
    val status: DownloadStatus = DownloadStatus.COMPLETED,
    val progress: Float = 1f,
    val error: String? = null,
)

/** Datos propios guardados dentro de la descarga de Media3 (DownloadRequest.data). */
@Serializable
private data class DownloadMeta(
    val animeId: Int,
    val episode: Int,
    val animeTitle: String,
    val coverUrl: String? = null,
    val bannerUrl: String? = null,
    val totalEpisodes: Int? = null,
    val audio: String = "sub",
    val quality: Int = 720,
    val mimeType: String? = null,
    val subtitles: List<LocalSubtitle> = emptyList(),
    val addedAt: Long = System.currentTimeMillis(),
)

@Serializable
private data class LocalSubtitle(val path: String, val language: String, val label: String, val mimeType: String)

/**
 * Descargas reales para ver sin conexión (motor de descargas de Media3, el mismo del reproductor):
 * bajan todos los trozos del video HLS a una caché privada, siguen en segundo plano con una
 * notificación ([KazeDownloadService]), se pueden pausar y respetan "solo con Wi-Fi".
 */
@OptIn(UnstableApi::class)
@Singleton
class DownloadRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val http: OkHttpClient,
    private val json: Json,
    private val provider: MediaProvider,
    private val prefs: UserPreferencesRepository,
    private val analytics: com.kaze.mobile.core.analytics.KazeAnalytics,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val baseDir = File(context.getExternalFilesDir(null) ?: context.filesDir, "kaze-offline")
    private val subtitleDir = File(baseDir, "subtitles").apply { mkdirs() }
    private val databaseProvider = StandaloneDatabaseProvider(context)
    val cache = SimpleCache(File(baseDir, "media"), NoOpCacheEvictor(), databaseProvider)
    private val httpFactory: DataSource.Factory = DefaultHttpDataSource.Factory()
        .setUserAgent("KAZE-Android")
        .setAllowCrossProtocolRedirects(true)
        .setConnectTimeoutMs(15_000)
        .setReadTimeoutMs(20_000)

    /** Para el reproductor: lee lo descargado y, si falta algo, lo pide a internet. */
    val playbackDataSourceFactory: DataSource.Factory = CacheDataSource.Factory()
        .setCache(cache)
        .setUpstreamDataSourceFactory(DefaultDataSource.Factory(context, httpFactory))
        .setCacheWriteDataSinkFactory(null)

    val manager: DownloadManager = DownloadManager(context, databaseProvider, cache, httpFactory, Executors.newFixedThreadPool(2)).apply {
        maxParallelDownloads = 1 // de uno en uno: la mitad de los trozos pasan por la VPS (1 núcleo)
        minRetryCount = 5
    }

    /** Descargas que se están preparando (pidiendo el enlace al servidor) antes de entrar a Media3. */
    private val preparing = MutableStateFlow<Map<String, DownloadedEpisode>>(emptyMap())
    private val failedPrepare = MutableStateFlow<Map<String, DownloadedEpisode>>(emptyMap())
    private val _downloads = MutableStateFlow<List<DownloadedEpisode>>(emptyList())
    val downloads: StateFlow<List<DownloadedEpisode>> = _downloads.asStateFlow()

    init {
        manager.addListener(object : DownloadManager.Listener {
            override fun onDownloadChanged(downloadManager: DownloadManager, download: Download, finalException: Exception?) {
                refresh()
                notifyFinished(download)
            }
            override fun onDownloadRemoved(downloadManager: DownloadManager, download: Download) = refresh()
            override fun onRequirementsStateChanged(downloadManager: DownloadManager, requirements: Requirements, notMetRequirements: Int) = refresh()
            override fun onInitialized(downloadManager: DownloadManager) = refresh()
        })
        // Media3 no avisa del avance: mientras haya algo bajando, se actualiza el porcentaje cada segundo.
        scope.launch {
            while (isActive) {
                delay(1_000)
                if (manager.currentDownloads.any { it.state == Download.STATE_DOWNLOADING }) refresh()
            }
        }
        // "Solo con Wi-Fi" se aplica en cuanto cambias el ajuste.
        scope.launch {
            prefs.prefs.map { it.downloadWifiOnly }.distinctUntilChanged().collect { wifiOnly ->
                val req = Requirements(if (wifiOnly) Requirements.NETWORK_UNMETERED else Requirements.NETWORK)
                runCatching { DownloadService.sendSetRequirements(context, KazeDownloadService::class.java, req, false) }
                    .onFailure { manager.requirements = req }
            }
        }
    }

    private val finishedNotifications by lazy { androidx.media3.exoplayer.offline.DownloadNotificationHelper(context, "downloads") }

    /** Aviso cuando un episodio termina de bajar (o falla), aunque la app esté cerrada. */
    @android.annotation.SuppressLint("MissingPermission") // se comprueba con areNotificationsEnabled()
    private fun notifyFinished(download: Download) {
        if (!androidx.core.app.NotificationManagerCompat.from(context).areNotificationsEnabled()) return
        if (download.state != Download.STATE_COMPLETED && download.state != Download.STATE_FAILED) return
        val meta = runCatching { json.decodeFromString(DownloadMeta.serializer(), String(download.request.data)) }.getOrNull() ?: return
        val name = "${meta.animeTitle} · EP ${meta.episode}"
        val open = android.app.PendingIntent.getActivity(
            context, 0,
            android.content.Intent(android.content.Intent.ACTION_VIEW, Uri.parse("kaze://lists?tab=downloads"), context, com.kaze.mobile.MainActivity::class.java)
                .addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK or android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP),
            android.app.PendingIntent.FLAG_IMMUTABLE or android.app.PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val n = if (download.state == Download.STATE_COMPLETED)
            finishedNotifications.buildDownloadCompletedNotification(context, com.kaze.mobile.R.drawable.ic_stat_kaze, open, "$name · listo para ver sin conexión")
        else finishedNotifications.buildDownloadFailedNotification(context, com.kaze.mobile.R.drawable.ic_stat_kaze, open, "No se pudo descargar $name")
        runCatching { androidx.core.app.NotificationManagerCompat.from(context).notify(download.request.id.hashCode(), n) }
    }

    private fun refresh() {
        val notMet = manager.notMetRequirements
        val fromManager = buildList {
            manager.downloadIndex.getDownloads().use { cursor ->
                while (cursor.moveToNext()) cursor.download.toEpisode(notMet)?.let(::add)
            }
        }
        val ids = fromManager.map { it.id }.toSet()
        _downloads.value = (fromManager + preparing.value.values.filter { it.id !in ids } + failedPrepare.value.values.filter { it.id !in ids })
            .sortedWith(compareBy<DownloadedEpisode> { it.animeTitle.lowercase() }.thenBy { it.episode })
    }

    private fun Download.toEpisode(notMet: Int): DownloadedEpisode? {
        val meta = runCatching { json.decodeFromString(DownloadMeta.serializer(), String(request.data)) }.getOrNull() ?: return null
        val status = when (state) {
            Download.STATE_COMPLETED -> DownloadStatus.COMPLETED
            Download.STATE_DOWNLOADING -> DownloadStatus.DOWNLOADING
            Download.STATE_STOPPED -> DownloadStatus.PAUSED
            Download.STATE_FAILED -> DownloadStatus.FAILED
            Download.STATE_QUEUED -> if (notMet != 0) DownloadStatus.WAITING else DownloadStatus.QUEUED
            else -> DownloadStatus.QUEUED
        }
        return DownloadedEpisode(
            id = request.id, animeId = meta.animeId, episode = meta.episode, title = "Episodio ${meta.episode}",
            animeTitle = meta.animeTitle, coverUrl = meta.coverUrl, bannerUrl = meta.bannerUrl, totalEpisodes = meta.totalEpisodes,
            fileSizeBytes = bytesDownloaded, downloadedAt = meta.addedAt, audioOption = meta.audio, quality = meta.quality,
            status = status,
            progress = if (status == DownloadStatus.COMPLETED) 1f else (percentDownloaded.takeIf { it >= 0 } ?: 0f) / 100f,
            error = if (status == DownloadStatus.FAILED) "No se pudo descargar. Toca para reintentar." else null,
        )
    }

    fun get(animeId: Int, episode: Int): DownloadedEpisode? = _downloads.value.firstOrNull { it.id == "$animeId:$episode" }

    fun isDownloaded(animeId: Int, episode: Int): Boolean = get(animeId, episode)?.status == DownloadStatus.COMPLETED

    fun isDownloading(animeId: Int, episode: Int): Boolean =
        get(animeId, episode)?.status.let { it != null && it != DownloadStatus.COMPLETED && it != DownloadStatus.FAILED }

    /**
     * Pide el enlace del episodio (igual que el reproductor), elige la calidad de tus ajustes
     * y se lo pasa al servicio de descargas. También guarda los subtítulos externos.
     */
    fun startDownload(
        animeId: Int,
        episode: Int,
        animeTitle: String,
        coverUrl: String?,
        audio: String = "sub",
        bannerUrl: String? = null,
        totalEpisodes: Int? = null,
    ) {
        val id = "$animeId:$episode"
        get(animeId, episode)?.let { if (it.status != DownloadStatus.FAILED) return }
        scope.launch {
            val quality = runCatching { prefs.prefs.first().downloadQuality }.getOrDefault(720)
            val placeholder = DownloadedEpisode(
                id = id, animeId = animeId, episode = episode, title = "Episodio $episode", animeTitle = animeTitle,
                coverUrl = coverUrl, bannerUrl = bannerUrl, totalEpisodes = totalEpisodes, audioOption = audio, quality = quality,
                status = DownloadStatus.QUEUED, progress = 0f,
            )
            failedPrepare.value = failedPrepare.value - id
            preparing.value = preparing.value + (id to placeholder)
            refresh()
            try {
                val src = when (val r = provider.resolve(animeId, episode, animeTitle, preferredAudio = audio)) {
                    is Outcome.Success -> r.value
                    is Outcome.Failure -> throw IOException(r.error.userMessage)
                }
                if (src.demoNotice != null || src.uri.startsWith("file:")) throw IOException("Este episodio no está disponible para descargar.")
                val subs = withContext(Dispatchers.IO) { saveSubtitles(id, src.subtitles) }
                val meta = DownloadMeta(animeId, episode, animeTitle, coverUrl, bannerUrl, totalEpisodes, audio, quality, src.mimeType, subs)
                val item = MediaItem.Builder().setUri(src.uri).setMimeType(src.mimeType).setMediaId(id).build()
                val params = DownloadHelper.getDefaultTrackSelectorParameters(context).buildUpon()
                    .setMaxVideoSize(Int.MAX_VALUE, quality)
                    .setForceHighestSupportedBitrate(true)
                    .build()
                val helper = DownloadHelper.forMediaItem(item, params, DefaultRenderersFactory(context), httpFactory)
                val request = try {
                    helper.prepareAwait()
                    helper.getDownloadRequest(id, json.encodeToString(DownloadMeta.serializer(), meta).toByteArray())
                } finally {
                    helper.release()
                }
                DownloadService.sendAddDownload(context, KazeDownloadService::class.java, request, false)
                analytics.event("descarga_iniciada", mapOf("anime" to animeTitle, "animeId" to animeId, "episodio" to episode, "calidad" to quality))
            } catch (e: Exception) {
                Log.w("KazeDownloads", "No se pudo preparar $id: ${e.message}")
                failedPrepare.value = failedPrepare.value + (id to placeholder.copy(status = DownloadStatus.FAILED, error = e.message ?: "No se pudo descargar."))
            } finally {
                preparing.value = preparing.value - id
                refresh()
            }
        }
    }

    private suspend fun DownloadHelper.prepareAwait() = suspendCancellableCoroutine { cont ->
        prepare(object : DownloadHelper.Callback {
            override fun onPrepared(helper: DownloadHelper) { if (cont.isActive) cont.resume(Unit) }
            override fun onPrepareError(helper: DownloadHelper, e: IOException) { if (cont.isActive) cont.resumeWithException(e) }
        })
    }

    private suspend fun saveSubtitles(id: String, subs: List<SideloadedSubtitle>): List<LocalSubtitle> = subs.take(6).mapIndexedNotNull { i, s ->
        runCatching {
            val res = http.newCall(Request.Builder().url(s.url).build()).await()
            res.use {
                if (!it.isSuccessful) return@runCatching null
                val file = File(subtitleDir, "${id.replace(':', '_')}_$i.sub")
                file.writeBytes(it.body?.bytes() ?: return@runCatching null)
                LocalSubtitle(file.absolutePath, s.language, s.label, s.mimeType)
            }
        }.getOrNull()
    }

    /** MediaItem para reproducir sin conexión (con sus subtítulos guardados), o null si no está completa. */
    fun offlineItem(animeId: Int, episode: Int, title: String): MediaItem? {
        val d = runCatching { manager.downloadIndex.getDownload("$animeId:$episode") }.getOrNull() ?: return null
        if (d.state != Download.STATE_COMPLETED) return null
        val meta = runCatching { json.decodeFromString(DownloadMeta.serializer(), String(d.request.data)) }.getOrNull()
        return d.request.toMediaItem().buildUpon()
            .setMimeType(meta?.mimeType ?: d.request.mimeType)
            .setSubtitleConfigurations(meta?.subtitles.orEmpty().filter { File(it.path).exists() }.map { s ->
                MediaItem.SubtitleConfiguration.Builder(Uri.fromFile(File(s.path))).setMimeType(s.mimeType).setLanguage(s.language).setLabel(s.label).build()
            })
            .build()
    }

    fun offlineAudio(animeId: Int, episode: Int): String? = get(animeId, episode)?.audioOption

    fun pause(id: String) = DownloadService.sendSetStopReason(context, KazeDownloadService::class.java, id, STOP_REASON_USER, false)
    fun resume(id: String) = DownloadService.sendSetStopReason(context, KazeDownloadService::class.java, id, Download.STOP_REASON_NONE, false)

    /** Reintenta: vuelve a pedir el enlace (las firmas del servidor caducan a las 6 h). */
    fun retry(d: DownloadedEpisode) {
        deleteDownload(d.id)
        startDownload(d.animeId, d.episode, d.animeTitle, d.coverUrl, d.audioOption, d.bannerUrl, d.totalEpisodes)
    }

    fun deleteDownload(id: String) {
        failedPrepare.value = failedPrepare.value - id
        runCatching { DownloadService.sendRemoveDownload(context, KazeDownloadService::class.java, id, false) }
        subtitleDir.listFiles { f -> f.name.startsWith(id.replace(':', '_') + "_") }?.forEach { it.delete() }
        refresh()
    }

    fun deleteAnime(animeId: Int) = _downloads.value.filter { it.animeId == animeId }.forEach { deleteDownload(it.id) }

    fun totalStorageBytes(): Long = _downloads.value.filter { it.status == DownloadStatus.COMPLETED }.sumOf { it.fileSizeBytes }

    /** Espacio libre en el almacenamiento donde se guardan las descargas. */
    fun freeBytes(): Long = runCatching { baseDir.usableSpace }.getOrDefault(0L)

    companion object {
        const val STOP_REASON_USER = 1
    }
}

