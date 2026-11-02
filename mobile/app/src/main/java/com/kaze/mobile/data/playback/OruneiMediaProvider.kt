package com.kaze.mobile.data.playback

import android.net.Uri
import android.util.Log
import androidx.media3.common.MimeTypes
import com.kaze.mobile.core.common.Outcome
import com.kaze.mobile.data.anilist.await
import com.kaze.mobile.domain.playback.MediaAvailability
import com.kaze.mobile.domain.playback.MediaProvider
import com.kaze.mobile.domain.playback.PlaybackEntitlement
import com.kaze.mobile.domain.playback.PlaybackSource
import com.kaze.mobile.domain.playback.SideloadedSubtitle
import com.kaze.mobile.domain.playback.SkipKind
import com.kaze.mobile.domain.playback.SkipMarker
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Serializable
private data class SessionPayload(
    val seriesId: String,
    val episodeId: String,
    val preferredAudio: String = "sub",
    val preferredServer: String = "fast",
)

@Serializable
private data class SubtitlePayload(
    val src: String? = null,
    val url: String? = null,
    val language: String? = "es",
    val label: String? = "Español",
)

@Serializable
private data class MarkerPayload(
    val kind: String = "intro",
    val start: Double = 0.0,
    val end: Double = 0.0,
)

@Serializable
private data class AssetPayload(
    val id: String? = null,
    val kind: String = "hls",
    val src: String = "",
    val duration: Long = 0,
    val subtitles: List<SubtitlePayload> = emptyList(),
    val markers: List<MarkerPayload> = emptyList(),
)

@Serializable
private data class EpisodePayload(
    val id: String = "",
    val number: Int = 1,
    val title: String? = null,
)

@Serializable
private data class GrantPayload(
    val sessionId: String? = null,
    val episode: EpisodePayload? = null,
    val asset: AssetPayload,
    val audioLanguage: String? = null,
    val serverName: String? = null,
    val isDubbedAvailable: Boolean? = null,
    val expiresAt: Long? = null,
)

@Serializable
private data class PlaybackResponse(
    val grant: GrantPayload? = null,
    val error: String? = null,
    val reason: String? = null,
)

/**
 * Production media provider connecting directly to Orunei's playback session API.
 * Supports choosing between Japanese (SUB) and Latin Spanish (DUB), automated AniSkip markers,
 * offline playback of downloaded episodes, and seamless demo fallback.
 */
@Singleton
class OruneiMediaProvider @Inject constructor(
    private val http: OkHttpClient,
    private val json: Json,
    private val demoFallback: DemoMediaProvider,
    private val downloadRepo: DownloadRepository,
) : MediaProvider {

    override val id = "orunei-streaming"

    private val sessionEndpoint = "https://www.orunei.sbs/api/playback/session"
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    override suspend fun availability(animeId: Int, episode: Int): MediaAvailability =
        MediaAvailability.AVAILABLE_LICENSED

    override suspend fun resolve(animeId: Int, episode: Int, animeTitle: String): Outcome<PlaybackSource> =
        resolve(animeId, episode, animeTitle, preferredAudio = "sub")

    override suspend fun resolve(
        animeId: Int,
        episode: Int,
        animeTitle: String,
        preferredAudio: String,
    ): Outcome<PlaybackSource> = withContext(Dispatchers.IO) {
        // 1. Check if the episode is already downloaded locally
        val downloaded = downloadRepo.get(animeId, episode)
        if (downloaded != null) {
            val file = File(downloaded.filePath)
            if (file.exists() && file.length() > 0) {
                val label = if (downloaded.audioOption == "latino") "Audio Latino (Descargado)" else "Sub Español (Descargado)"
                return@withContext Outcome.Success(
                    PlaybackSource(
                        uri = Uri.fromFile(file).toString(),
                        mimeType = MimeTypes.VIDEO_MP4,
                        mediaTitle = label,
                        attribution = "Reproducción local offline",
                        entitlement = PlaybackEntitlement.Licensed("local", Long.MAX_VALUE),
                        subtitles = emptyList(),
                        skipMarkers = emptyList(),
                        demoNotice = null,
                        audioLanguage = if (downloaded.audioOption == "latino") "es-419" else "ja",
                        isDubbedAvailable = true,
                    )
                )
            }
        }

        // 2. Request live streaming session from Orunei
        try {
            val payload = SessionPayload(
                seriesId = animeId.toString(),
                episodeId = episode.toString(),
                preferredAudio = preferredAudio,
                preferredServer = "fast",
            )
            val body = json.encodeToString(SessionPayload.serializer(), payload)
            val request = Request.Builder()
                .url(sessionEndpoint)
                .post(body.toRequestBody(jsonMediaType))
                .header("Accept", "application/json")
                .header("Content-Type", "application/json")
                .build()

            val response = http.newCall(request).await()
            response.use { res ->
                if (!res.isSuccessful) {
                    Log.w("OruneiMediaProvider", "Session API returned ${res.code}, falling back to demo")
                    return@withContext demoFallback.resolve(animeId, episode, animeTitle, preferredAudio)
                }

                val text = res.body?.string().orEmpty()
                val result = json.decodeFromString(PlaybackResponse.serializer(), text)
                val grant = result.grant
                if (grant == null || grant.asset.src.isBlank()) {
                    Log.w("OruneiMediaProvider", "No playable grant in response, falling back to demo")
                    return@withContext demoFallback.resolve(animeId, episode, animeTitle, preferredAudio)
                }

                val asset = grant.asset
                val mimeType = if (asset.kind.equals("hls", ignoreCase = true) || asset.src.contains(".m3u8")) {
                    MimeTypes.APPLICATION_M3U8
                } else {
                    MimeTypes.VIDEO_MP4
                }

                val subs = asset.subtitles.mapNotNull { s ->
                    val subUrl = s.src ?: s.url ?: return@mapNotNull null
                    val subMime = if (subUrl.contains(".srt", ignoreCase = true)) {
                        MimeTypes.APPLICATION_SUBRIP
                    } else {
                        MimeTypes.TEXT_VTT
                    }
                    SideloadedSubtitle(
                        url = subUrl,
                        language = s.language ?: "es",
                        label = s.label ?: "Español",
                        mimeType = subMime,
                    )
                }

                val markers = asset.markers.map { m ->
                    val isIntro = m.kind.equals("intro", ignoreCase = true) || m.kind.equals("op", ignoreCase = true)
                    SkipMarker(
                        kind = if (isIntro) SkipKind.INTRO else SkipKind.CREDITS,
                        startMs = (m.start * 1000).toLong(),
                        endMs = (m.end * 1000).toLong(),
                        source = "AniSkip",
                    )
                }

                val serverLabel = grant.serverName ?: if (preferredAudio == "latino") "1080p Ultra Rápido (Audio Latino)" else "1080p Ultra Rápido (Sub Español)"
                val expires = grant.expiresAt ?: (System.currentTimeMillis() + 6 * 3600_000)

                Outcome.Success(
                    PlaybackSource(
                        uri = asset.src,
                        mimeType = mimeType,
                        mediaTitle = serverLabel,
                        attribution = "Orunei Streaming",
                        entitlement = PlaybackEntitlement.Licensed("orunei", expires),
                        subtitles = subs,
                        skipMarkers = markers,
                        demoNotice = null,
                        audioLanguage = grant.audioLanguage,
                        isDubbedAvailable = grant.isDubbedAvailable ?: false,
                    )
                )
            }
        } catch (e: Exception) {
            Log.w("OruneiMediaProvider", "Error resolving streaming session: ${e.message}, falling back to demo", e)
            demoFallback.resolve(animeId, episode, animeTitle, preferredAudio)
        }
    }
}
