package com.kaze.mobile.feature.player

import android.content.Context
import android.content.Intent
import com.kaze.mobile.domain.model.Anime

/** Everything the player needs to resolve playback for one episode of one title. */
data class PlaybackRequest(
    val animeId: Int,
    val episode: Int,
    val title: String,
    val coverUrl: String?,
    val bannerUrl: String?,
    val totalEpisodes: Int?,
)

object PlayerLauncher {
    const val EXTRA_ANIME_ID = "anime_id"
    const val EXTRA_EPISODE = "episode"
    const val EXTRA_TITLE = "title"
    const val EXTRA_COVER = "cover"
    const val EXTRA_BANNER = "banner"
    const val EXTRA_TOTAL = "total"

    fun launch(context: Context, request: PlaybackRequest) {
        val intent = Intent(context, PlayerActivity::class.java).apply {
            putExtra(EXTRA_ANIME_ID, request.animeId)
            putExtra(EXTRA_EPISODE, request.episode)
            putExtra(EXTRA_TITLE, request.title)
            putExtra(EXTRA_COVER, request.coverUrl)
            putExtra(EXTRA_BANNER, request.bannerUrl)
            putExtra(EXTRA_TOTAL, request.totalEpisodes ?: -1)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    fun launch(context: Context, anime: Anime, episode: Int = 1) = launch(
        context,
        PlaybackRequest(anime.id, episode, anime.displayTitle, anime.coverUrl, anime.bannerUrl, anime.episodes),
    )

    fun parse(intent: Intent): PlaybackRequest? {
        val id = intent.getIntExtra(EXTRA_ANIME_ID, -1).takeIf { it > 0 } ?: return null
        return PlaybackRequest(
            animeId = id,
            episode = intent.getIntExtra(EXTRA_EPISODE, 1).coerceAtLeast(1),
            title = intent.getStringExtra(EXTRA_TITLE) ?: "Anime",
            coverUrl = intent.getStringExtra(EXTRA_COVER),
            bannerUrl = intent.getStringExtra(EXTRA_BANNER),
            totalEpisodes = intent.getIntExtra(EXTRA_TOTAL, -1).takeIf { it > 0 },
        )
    }
}

fun Context.openExternalUrl(url: String) {
    // Only https links leave the app; anything else is ignored.
    if (!url.startsWith("https://")) return
    runCatching {
        startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}
