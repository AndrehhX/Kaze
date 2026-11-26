package com.kaze.mobile.data.playback

import android.app.Notification
import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import androidx.annotation.OptIn
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.offline.Download
import androidx.media3.exoplayer.offline.DownloadManager
import androidx.media3.exoplayer.offline.DownloadNotificationHelper
import androidx.media3.exoplayer.offline.DownloadService
import androidx.media3.exoplayer.scheduler.PlatformScheduler
import androidx.media3.exoplayer.scheduler.Scheduler
import com.kaze.mobile.MainActivity
import com.kaze.mobile.R
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

/**
 * Servicio en primer plano que baja los episodios aunque cierres la app.
 * Muestra una notificación con el progreso y avisa cuando un episodio termina.
 */
@OptIn(UnstableApi::class)
@AndroidEntryPoint
class KazeDownloadService : DownloadService(
    FOREGROUND_NOTIFICATION_ID,
    DEFAULT_FOREGROUND_NOTIFICATION_UPDATE_INTERVAL,
    CHANNEL_ID,
    R.string.channel_downloads,
    R.string.channel_downloads_desc,
) {
    @Inject lateinit var repo: DownloadRepository

    private val notifications by lazy { DownloadNotificationHelper(this, CHANNEL_ID) }

    // Los avisos de "listo" o "falló" los manda DownloadRepository (vive más que este servicio).
    override fun getDownloadManager(): DownloadManager = repo.manager

    override fun getScheduler(): Scheduler = PlatformScheduler(this, JOB_ID)

    override fun getForegroundNotification(downloads: MutableList<Download>, notMetRequirements: Int): Notification {
        val active = downloads.count { it.state == Download.STATE_DOWNLOADING || it.state == Download.STATE_QUEUED }
        val message = when {
            notMetRequirements != 0 -> "Esperando Wi-Fi para seguir descargando"
            active == 1 -> "Descargando 1 episodio"
            else -> "Descargando $active episodios"
        }
        return notifications.buildProgressNotification(this, R.drawable.ic_stat_kaze, openDownloads(), message, downloads, notMetRequirements)
    }

    private fun openDownloads(): PendingIntent = PendingIntent.getActivity(
        this, 0,
        Intent(Intent.ACTION_VIEW, Uri.parse("kaze://lists?tab=downloads"), this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

    private companion object {
        const val FOREGROUND_NOTIFICATION_ID = 7301
        const val CHANNEL_ID = "downloads"
        const val JOB_ID = 7302
    }
}
