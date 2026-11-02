package com.kaze.mobile.feature.player

import android.app.PictureInPictureParams
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.graphics.Color as AndroidColor
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Rational
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalConfiguration
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.kaze.mobile.MainActivity
import com.kaze.mobile.core.designsystem.theme.KazeTheme
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

/**
 * Dedicated player activity (own task affinity) so Picture-in-Picture floats independently
 * of the main app. The ExoPlayer lives in [PlayerViewModel] and survives rotation and PiP.
 */
@AndroidEntryPoint
class PlayerActivity : ComponentActivity() {

    private val vm: PlayerViewModel by viewModels()
    private var inPip by mutableStateOf(false)
    private var fullscreen by mutableStateOf(false)
    private var volumeAccumulator = 0f

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // The player is always dark, so system bar icons stay light whatever the system theme.
        enableEdgeToEdge(SystemBarStyle.dark(AndroidColor.TRANSPARENT), SystemBarStyle.dark(AndroidColor.TRANSPARENT))
        val request = PlayerLauncher.parse(intent) ?: run { finish(); return }
        vm.start(request)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (fullscreen) applyFullscreen(false) else finish()
            }
        })

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                vm.ui.map { it.isPlaying to it.videoAspect }.distinctUntilChanged().collect { (playing, aspect) ->
                    if (playing) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                    else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                    updatePipParams(playing, aspect)
                }
            }
        }

        setContent {
            val prefs by vm.prefs.collectAsStateWithLifecycle()
            val p = prefs ?: return@setContent
            val config = LocalConfiguration.current
            val landscape = config.orientation == Configuration.ORIENTATION_LANDSCAPE
            val wide = isTabletWide(config)
            KazeTheme(themeId = p.theme, reducedMotion = p.reducedMotion, ambientEffects = false, highContrast = p.highContrast) {
                PlayerScreen(
                    vm,
                    PlayerChrome(
                        isFullscreen = fullscreen || (landscape && !wide),
                        isInPip = inPip,
                        isWide = wide,
                        onToggleFullscreen = { applyFullscreen(!(fullscreen || (landscape && !wide))) },
                        onEnterPip = ::enterPip,
                        onBack = { if (fullscreen) applyFullscreen(false) else finish() },
                        onOpenAnime = ::openAnime,
                        adjustBrightness = ::adjustBrightness,
                        adjustVolume = ::adjustVolume,
                    ),
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        PlayerLauncher.parse(intent)?.let { setIntent(intent); vm.start(it) }
    }

    private fun applyFullscreen(on: Boolean) {
        fullscreen = on
        requestedOrientation = if (on) ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE else ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        val controller = WindowCompat.getInsetsController(window, window.decorView)
        if (on) {
            controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            controller.hide(WindowInsetsCompat.Type.systemBars())
        } else controller.show(WindowInsetsCompat.Type.systemBars())
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        val landscape = newConfig.orientation == Configuration.ORIENTATION_LANDSCAPE
        val controller = WindowCompat.getInsetsController(window, window.decorView)
        if (landscape && !isTabletWide(newConfig)) {
            controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            controller.hide(WindowInsetsCompat.Type.systemBars())
        } else if (!fullscreen) controller.show(WindowInsetsCompat.Type.systemBars())
    }

    /**
     * Side-by-side player only on tablets/foldables. A phone in landscape is ~900dp wide too,
     * so width alone would wrongly give phones the two-pane layout instead of fullscreen.
     */
    private fun isTabletWide(config: Configuration) = config.smallestScreenWidthDp >= 600 && config.screenWidthDp >= 840

    private fun pipParams(playing: Boolean, aspect: Float): PictureInPictureParams {
        val ratio = aspect.coerceIn(0.42f, 2.39f)
        val builder = PictureInPictureParams.Builder().setAspectRatio(Rational((ratio * 1000).toInt(), 1000))
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) builder.setAutoEnterEnabled(playing).setSeamlessResizeEnabled(true)
        return builder.build()
    }

    private fun updatePipParams(playing: Boolean, aspect: Float) {
        runCatching { setPictureInPictureParams(pipParams(playing, aspect)) }
    }

    private fun enterPip() {
        if (!packageManager.hasSystemFeature(android.content.pm.PackageManager.FEATURE_PICTURE_IN_PICTURE)) return
        val ui = vm.ui.value
        runCatching { enterPictureInPictureMode(pipParams(ui.isPlaying, ui.videoAspect)) }
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        // API 31+ uses auto-enter; older devices enter PiP manually when leaving mid-playback.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S && vm.ui.value.isPlaying) enterPip()
    }

    override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean, newConfig: Configuration) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        inPip = isInPictureInPictureMode
        // PiP window dismissed by the user: stop playback instead of playing invisibly.
        if (!isInPictureInPictureMode && lifecycle.currentState == Lifecycle.State.CREATED) vm.pause()
    }

    override fun onStop() {
        super.onStop()
        vm.onBackground()
        if (!isInPictureInPictureMode) vm.pause()
    }

    private fun adjustBrightness(delta: Float): Float {
        val attrs = window.attributes
        val current = if (attrs.screenBrightness < 0) 0.5f else attrs.screenBrightness
        val next = (current + delta).coerceIn(0.02f, 1f)
        attrs.screenBrightness = next
        window.attributes = attrs
        return next
    }

    private fun adjustVolume(delta: Float): Float {
        val am = getSystemService(AudioManager::class.java) ?: return 0f
        val max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        volumeAccumulator += delta * max
        val steps = volumeAccumulator.toInt()
        if (steps != 0) {
            volumeAccumulator -= steps
            val next = (am.getStreamVolume(AudioManager.STREAM_MUSIC) + steps).coerceIn(0, max)
            am.setStreamVolume(AudioManager.STREAM_MUSIC, next, 0)
        }
        return am.getStreamVolume(AudioManager.STREAM_MUSIC).toFloat() / max
    }

    private fun openAnime() {
        val id = vm.ui.value.request?.animeId ?: return
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("kaze://anime/$id"), this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}
