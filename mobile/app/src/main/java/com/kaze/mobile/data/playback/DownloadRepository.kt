package com.kaze.mobile.data.playback

import android.content.Context
import android.util.Log
import com.kaze.mobile.data.anilist.await
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.io.FileOutputStream
import javax.inject.Inject
import javax.inject.Singleton

@Serializable
enum class DownloadStatus { QUEUED, DOWNLOADING, COMPLETED, FAILED }

@Serializable
data class DownloadedEpisode(
    val id: String, // "$animeId:$episode"
    val animeId: Int,
    val episode: Int,
    val title: String,
    val animeTitle: String,
    val coverUrl: String? = null,
    val filePath: String,
    val fileSizeBytes: Long = 0,
    val downloadedAt: Long = System.currentTimeMillis(),
    val audioOption: String = "sub", // "sub" or "latino"
    val status: DownloadStatus = DownloadStatus.COMPLETED,
    val progress: Float = 1f,
    val error: String? = null,
)

@Serializable
private data class DownloadSessionPayload(
    val seriesId: String,
    val episodeId: String,
    val preferredAudio: String = "sub",
    val codecPreference: String = "h264",
)

@Serializable
private data class DownloadAsset(
    val kind: String = "mp4",
    val src: String = "",
)

@Serializable
private data class DownloadGrant(
    val asset: DownloadAsset,
    val serverName: String? = null,
    val isDubbedAvailable: Boolean? = null,
)

@Serializable
private data class DownloadSessionResponse(
    val grant: DownloadGrant? = null,
    val error: String? = null,
)

@Singleton
class DownloadRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val http: OkHttpClient,
    private val json: Json,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val downloadDir = File(context.filesDir, "downloads").apply { mkdirs() }
    private val indexFile = File(context.filesDir, "downloads_index.json")

    private val _downloads = MutableStateFlow<List<DownloadedEpisode>>(emptyList())
    val downloads: StateFlow<List<DownloadedEpisode>> = _downloads.asStateFlow()

    init {
        loadIndex()
    }

    private fun loadIndex() {
        try {
            if (indexFile.exists()) {
                val text = indexFile.readText()
                val list = json.decodeFromString(ListSerializer(DownloadedEpisode.serializer()), text)
                // Filter out any entries whose files were deleted externally
                val valid = list.filter { File(it.filePath).exists() }
                _downloads.value = valid
            }
        } catch (e: Exception) {
            Log.w("DownloadRepository", "Could not load downloads index: ${e.message}")
            _downloads.value = emptyList()
        }
    }

    private fun saveIndex() {
        try {
            val text = json.encodeToString(ListSerializer(DownloadedEpisode.serializer()), _downloads.value)
            indexFile.writeText(text)
        } catch (e: Exception) {
            Log.w("DownloadRepository", "Could not save downloads index: ${e.message}")
        }
    }

    fun get(animeId: Int, episode: Int): DownloadedEpisode? {
        val key = "$animeId:$episode"
        return _downloads.value.firstOrNull { it.id == key && it.status == DownloadStatus.COMPLETED && File(it.filePath).exists() }
    }

    fun isDownloaded(animeId: Int, episode: Int): Boolean = get(animeId, episode) != null

    fun isDownloading(animeId: Int, episode: Int): Boolean {
        val key = "$animeId:$episode"
        return _downloads.value.any { it.id == key && (it.status == DownloadStatus.DOWNLOADING || it.status == DownloadStatus.QUEUED) }
    }

    fun startDownload(
        animeId: Int,
        episode: Int,
        animeTitle: String,
        coverUrl: String?,
        audio: String = "sub",
    ) {
        val key = "$animeId:$episode"
        val existing = get(animeId, episode)
        if (existing != null) return

        val targetFile = File(downloadDir, "kaze_${animeId}_ep_${episode}_${audio}.mp4")
        val item = DownloadedEpisode(
            id = key,
            animeId = animeId,
            episode = episode,
            title = "Episodio $episode",
            animeTitle = animeTitle,
            coverUrl = coverUrl,
            filePath = targetFile.absolutePath,
            audioOption = audio,
            status = DownloadStatus.QUEUED,
            progress = 0f,
        )

        _downloads.update { current -> current.filterNot { it.id == key } + item }
        saveIndex()

        scope.launch {
            try {
                _downloads.update { list ->
                    list.map { if (it.id == key) it.copy(status = DownloadStatus.DOWNLOADING) else it }
                }

                // 1. Resolve direct downloadable stream from Orunei
                val sessionEndpoint = "https://www.orunei.sbs/api/playback/session"
                val payload = DownloadSessionPayload(
                    seriesId = animeId.toString(),
                    episodeId = episode.toString(),
                    preferredAudio = audio,
                    codecPreference = "h264",
                )
                val body = json.encodeToString(DownloadSessionPayload.serializer(), payload)
                val sessionReq = Request.Builder()
                    .url(sessionEndpoint)
                    .post(body.toRequestBody("application/json; charset=utf-8".toMediaType()))
                    .header("Accept", "application/json")
                    .build()

                val sessionRes = http.newCall(sessionReq).await()
                val sessionText = sessionRes.body?.string().orEmpty()
                val grant = json.decodeFromString(DownloadSessionResponse.serializer(), sessionText).grant
                val streamUrl = grant?.asset?.src

                if (streamUrl.isNullOrBlank()) {
                    throw IllegalStateException("No se pudo obtener el stream descargable para el episodio $episode")
                }

                // 2. Stream video file directly to disk with progress
                val fileReq = Request.Builder().url(streamUrl).build()
                val fileRes = http.newCall(fileReq).await()
                val fileBody = fileRes.body ?: throw IllegalStateException("Cuerpo de descarga vacío")

                val totalLength = fileBody.contentLength()
                val inputStream = fileBody.byteStream()
                val outputStream = FileOutputStream(targetFile)

                val buffer = ByteArray(64 * 1024)
                var bytesRead: Int
                var totalBytesRead = 0L

                inputStream.use { input ->
                    outputStream.use { output ->
                        while (input.read(buffer).also { bytesRead = it } != -1) {
                            output.write(buffer, 0, bytesRead)
                            totalBytesRead += bytesRead
                            if (totalLength > 0) {
                                val progress = (totalBytesRead.toFloat() / totalLength).coerceIn(0f, 1f)
                                _downloads.update { list ->
                                    list.map { if (it.id == key) it.copy(progress = progress) else it }
                                }
                            }
                        }
                    }
                }

                val finalSize = targetFile.length()
                _downloads.update { list ->
                    list.map {
                        if (it.id == key) it.copy(
                            status = DownloadStatus.COMPLETED,
                            progress = 1f,
                            fileSizeBytes = finalSize,
                            downloadedAt = System.currentTimeMillis()
                        ) else it
                    }
                }
                saveIndex()
                Log.i("DownloadRepository", "Descarga completada con éxito: $key ($finalSize bytes)")

            } catch (e: Exception) {
                Log.e("DownloadRepository", "Error descargando episodio $key: ${e.message}", e)
                targetFile.delete()
                _downloads.update { list ->
                    list.map {
                        if (it.id == key) it.copy(status = DownloadStatus.FAILED, error = e.message ?: "Error de red") else it
                    }
                }
                saveIndex()
            }
        }
    }

    fun deleteDownload(id: String) {
        val item = _downloads.value.firstOrNull { it.id == id } ?: return
        try {
            val file = File(item.filePath)
            if (file.exists()) file.delete()
        } catch (e: Exception) {
            Log.w("DownloadRepository", "Error deleting file: ${e.message}")
        }
        _downloads.update { list -> list.filterNot { it.id == id } }
        saveIndex()
    }

    fun totalStorageBytes(): Long =
        _downloads.value.filter { it.status == DownloadStatus.COMPLETED }.sumOf { it.fileSizeBytes }
}
