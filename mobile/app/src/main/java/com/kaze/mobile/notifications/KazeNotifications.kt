package com.kaze.mobile.notifications

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.hilt.work.HiltWorker
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.kaze.mobile.MainActivity
import com.kaze.mobile.R
import com.kaze.mobile.core.common.Outcome
import com.kaze.mobile.core.datastore.UserPreferencesRepository
import com.kaze.mobile.data.anilist.AniListRepository
import com.kaze.mobile.data.backend.SocialRepository
import com.kaze.mobile.data.library.LibraryRepository
import com.kaze.mobile.domain.model.LibraryStatus
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import java.time.Instant
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

enum class KazeChannel(val id: String, val nameRes: Int, val descRes: Int, val importance: Int, val group: String) {
    SOCIAL("social", R.string.channel_social, R.string.channel_social_desc, NotificationManager.IMPORTANCE_DEFAULT, "kaze.social"),
    PARTIES("parties", R.string.channel_parties, R.string.channel_parties_desc, NotificationManager.IMPORTANCE_HIGH, "kaze.parties"),
    EPISODES("episodes", R.string.channel_episodes, R.string.channel_episodes_desc, NotificationManager.IMPORTANCE_DEFAULT, "kaze.episodes"),
}

@Singleton
class NotificationHelper @Inject constructor(@ApplicationContext private val context: Context) {

    fun createChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = context.getSystemService(NotificationManager::class.java) ?: return
        KazeChannel.entries.forEach { ch ->
            nm.createNotificationChannel(NotificationChannel(ch.id, context.getString(ch.nameRes), ch.importance).apply { description = context.getString(ch.descRes) })
        }
    }

    fun canPost(): Boolean =
        NotificationManagerCompat.from(context).areNotificationsEnabled() &&
            (Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)

    /** Posts a deep-linked notification; [deepLink] must be a kaze:// content link. */
    @android.annotation.SuppressLint("MissingPermission") // guarded by canPost(), which checks POST_NOTIFICATIONS
    fun post(channel: KazeChannel, id: Int, title: String, text: String, deepLink: String) {
        if (!canPost()) return
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(deepLink), context, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val pi = PendingIntent.getActivity(context, id, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val n = NotificationCompat.Builder(context, channel.id)
            .setSmallIcon(R.drawable.ic_stat_kaze)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setContentIntent(pi)
            .setAutoCancel(true)
            .setGroup(channel.group)
            .build()
        val summary = NotificationCompat.Builder(context, channel.id)
            .setSmallIcon(R.drawable.ic_stat_kaze)
            .setContentTitle(context.getString(channel.nameRes))
            .setGroup(channel.group)
            .setGroupSummary(true)
            .setAutoCancel(true)
            .build()
        runCatching {
            NotificationManagerCompat.from(context).notify(id, n)
            NotificationManagerCompat.from(context).notify(channel.group.hashCode(), summary)
        }
    }
}

/**
 * Background refresh (≥ every hour, network required, battery-friendly):
 *  - new episodes: AniList airing schedule for titles the user is WATCHING (real data only)
 *  - social/party: unread rows from the KAZE backend notifications table (if signed in)
 * There is no fake push service. Real-time push via FCM is documented as a backend extension.
 */
@HiltWorker
class KazeRefreshWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val prefs: UserPreferencesRepository,
    private val library: LibraryRepository,
    private val anilist: AniListRepository,
    private val social: SocialRepository,
    private val notifier: NotificationHelper,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val p = prefs.prefs.first()
        val store = applicationContext.getSharedPreferences("kaze_worker", Context.MODE_PRIVATE)
        val nowSec = System.currentTimeMillis() / 1000
        val lastSec = store.getLong("last_check", nowSec - 3600).coerceAtLeast(nowSec - 2 * 86_400)

        if (p.notifyEpisodes) {
            val watching = library.snapshot().filter { it.status == LibraryStatus.WATCHING || it.status == LibraryStatus.REWATCHING }
            val r = anilist.airingFor(watching.map { it.animeId }, lastSec, nowSec)
            if (r is Outcome.Success) r.value.forEach { slot ->
                notifier.post(KazeChannel.EPISODES, (slot.anime.id * 1000 + slot.episode), "${slot.anime.displayTitle} · Episode ${slot.episode}", "A new episode just aired. Watch it on an official service.", "kaze://anime/${slot.anime.id}")
            }
            else if (r is Outcome.Failure) return Result.retry()
        }
        if (social.isAvailable && (p.notifySocial || p.notifyParties)) {
            val since = Instant.ofEpochSecond(lastSec).toString()
            (social.unreadSince(since) as? Outcome.Success)?.value?.forEach { n ->
                val isParty = n.type == "party_invite"
                if ((isParty && p.notifyParties) || (!isParty && p.notifySocial)) {
                    val link = if (isParty && n.entityId != null) "kaze://party/${n.entityId}" else "kaze://notifications"
                    notifier.post(if (isParty) KazeChannel.PARTIES else KazeChannel.SOCIAL, n.id.hashCode(), n.title, n.body.ifBlank { "Open KAZE to see more." }, link)
                }
            }
        }
        store.edit().putLong("last_check", nowSec).apply()
        return Result.success()
    }

    companion object {
        fun schedule(context: Context) {
            val req = PeriodicWorkRequestBuilder<KazeRefreshWorker>(1, TimeUnit.HOURS)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).setRequiresBatteryNotLow(true).build())
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork("kaze-refresh", ExistingPeriodicWorkPolicy.KEEP, req)
        }
    }
}
