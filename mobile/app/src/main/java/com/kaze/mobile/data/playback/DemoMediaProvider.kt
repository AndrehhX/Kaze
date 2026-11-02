package com.kaze.mobile.data.playback

import androidx.media3.common.MimeTypes
import com.kaze.mobile.core.common.Outcome
import com.kaze.mobile.domain.playback.MediaAvailability
import com.kaze.mobile.domain.playback.MediaProvider
import com.kaze.mobile.domain.playback.PlaybackEntitlement
import com.kaze.mobile.domain.playback.PlaybackSource
import com.kaze.mobile.domain.playback.SideloadedSubtitle
import com.kaze.mobile.domain.playback.SkipKind
import com.kaze.mobile.domain.playback.SkipMarker
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Authorized demonstration provider. Every stream here is either an openly licensed
 * Blender Foundation film (CC BY 3.0) or a test stream its owner publishes for player testing.
 * Episode N of any anime maps to one of these films and the UI states that plainly.
 * Skip markers are hand-authored for these films and labelled "demo markers".
 */
@Singleton
class DemoMediaProvider @Inject constructor() : MediaProvider {

    override val id = "kaze-demo"

    private data class DemoTitle(
        val uri: String,
        val title: String,
        val attribution: String,
        val license: String,
        val subtitles: List<SideloadedSubtitle>,
        val markers: List<SkipMarker>,
    )

    private val blenderSubs = "https://download.blender.org/demo/movies/ToS/subtitles/"

    private val catalog = listOf(
        DemoTitle(
            uri = "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
            title = "Tears of Steel",
            attribution = "Tears of Steel © Blender Foundation | mango.blender.org — CC BY 3.0. Stream: Unified Streaming demo server.",
            license = "CC BY 3.0",
            subtitles = listOf(
                SideloadedSubtitle(blenderSubs + "TOS-en.srt", "en", "English", MimeTypes.APPLICATION_SUBRIP),
                SideloadedSubtitle(blenderSubs + "TOS-JP.srt", "ja", "日本語", MimeTypes.APPLICATION_SUBRIP),
                SideloadedSubtitle(blenderSubs + "TOS-es.srt", "es", "Español", MimeTypes.APPLICATION_SUBRIP),
                SideloadedSubtitle(blenderSubs + "TOS-de.srt", "de", "Deutsch", MimeTypes.APPLICATION_SUBRIP),
                SideloadedSubtitle(blenderSubs + "TOS-PT-BR.srt", "pt-BR", "Português (BR)", MimeTypes.APPLICATION_SUBRIP),
                SideloadedSubtitle(blenderSubs + "TOS-it.srt", "it", "Italiano", MimeTypes.APPLICATION_SUBRIP),
            ),
            markers = listOf(
                SkipMarker(SkipKind.INTRO, 0, 26_000, "Demo markers"),
                SkipMarker(SkipKind.CREDITS, 669_000, 734_000, "Demo markers"),
            ),
        ),
        DemoTitle(
            uri = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
            title = "Big Buck Bunny",
            attribution = "Big Buck Bunny © Blender Foundation | peach.blender.org — CC BY 3.0. Stream: Mux test streams.",
            license = "CC BY 3.0",
            subtitles = emptyList(),
            markers = listOf(
                SkipMarker(SkipKind.INTRO, 0, 23_000, "Demo markers"),
                SkipMarker(SkipKind.CREDITS, 490_000, 596_000, "Demo markers"),
            ),
        ),
        DemoTitle(
            uri = "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8",
            title = "Apple HLS test pattern",
            attribution = "Apple HLS advanced example stream (fMP4, multiple audio renditions and WebVTT subtitles), published by Apple for HLS player testing.",
            license = "Apple developer test stream",
            subtitles = emptyList(),
            markers = emptyList(),
        ),
    )

    override suspend fun availability(animeId: Int, episode: Int) = MediaAvailability.AVAILABLE_DEMO

    override suspend fun resolve(animeId: Int, episode: Int, animeTitle: String): Outcome<PlaybackSource> {
        val demo = catalog[(episode - 1).mod(catalog.size)]
        return Outcome.Success(
            PlaybackSource(
                uri = demo.uri,
                mimeType = MimeTypes.APPLICATION_M3U8,
                mediaTitle = demo.title,
                attribution = demo.attribution,
                entitlement = PlaybackEntitlement.OpenDemo(demo.license),
                subtitles = demo.subtitles,
                skipMarkers = demo.markers,
                demoNotice = "Demo stream: \"${demo.title}\" is playing in place of $animeTitle episode $episode. KAZE does not stream anime.",
            )
        )
    }
}
