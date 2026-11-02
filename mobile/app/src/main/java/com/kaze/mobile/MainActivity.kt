package com.kaze.mobile

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.windowsizeclass.ExperimentalMaterial3WindowSizeClassApi
import androidx.compose.material3.windowsizeclass.calculateWindowSizeClass
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.navigation.compose.rememberNavController
import com.kaze.mobile.core.datastore.UserPreferencesRepository
import com.kaze.mobile.core.datastore.UserPrefs
import com.kaze.mobile.core.designsystem.theme.KazeBackdrop
import com.kaze.mobile.core.designsystem.theme.KazePalettes
import com.kaze.mobile.core.designsystem.theme.KazeTheme
import com.kaze.mobile.navigation.KazeAppShell
import com.kaze.mobile.navigation.SocialShell
import dagger.hilt.android.AndroidEntryPoint
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject
import androidx.activity.viewModels

@HiltViewModel
class AppViewModel @Inject constructor(prefs: UserPreferencesRepository) : ViewModel() {
    /** Null until DataStore has been read once — the splash stays up so the wrong theme never flashes. */
    val prefs: StateFlow<UserPrefs?> = prefs.prefs.stateIn(viewModelScope, SharingStarted.Eagerly, null)
}

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    private val appVm: AppViewModel by viewModels()
    @Inject lateinit var social: SocialShell
    @Inject lateinit var deepLinks: DeepLinkRouter

    @OptIn(ExperimentalMaterial3WindowSizeClassApi::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        val splash = installSplashScreen()
        super.onCreate(savedInstanceState)
        splash.setKeepOnScreenCondition { appVm.prefs.value == null }
        if (savedInstanceState == null) deepLinks.handleAuthCallback(intent)

        setContent {
            val prefs by appVm.prefs.collectAsStateWithLifecycle()
            val p = prefs ?: return@setContent
            val themeId = p.effectiveTheme(isSystemInDarkTheme())
            val palette = KazePalettes.of(themeId)
            DisposableEffect(themeId) {
                val bars = if (themeId.isDark) SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
                else SystemBarStyle.light(android.graphics.Color.TRANSPARENT, palette.text.toArgb())
                enableEdgeToEdge(statusBarStyle = bars, navigationBarStyle = bars)
                window.setBackgroundDrawable(android.graphics.drawable.ColorDrawable(palette.background.toArgb()))
                onDispose { }
            }
            KazeTheme(
                themeId = themeId,
                reducedMotion = p.reducedMotion,
                ambientEffects = p.ambientEffects,
                wallpaperAccent = p.wallpaperAccent,
                highContrast = p.highContrast,
            ) {
                val nav = rememberNavController()
                deepLinks.Bind(nav)
                Box(Modifier.fillMaxSize()) {
                    KazeBackdrop(Modifier.fillMaxSize())
                    KazeAppShell(
                        nav = nav,
                        widthClass = calculateWindowSizeClass(this@MainActivity).widthSizeClass,
                        startOnboarding = !p.onboardingDone,
                        social = social,
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (!deepLinks.handleAuthCallback(intent)) deepLinks.dispatch(intent)
    }
}
