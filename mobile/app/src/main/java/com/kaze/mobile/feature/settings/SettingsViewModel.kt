package com.kaze.mobile.feature.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kaze.mobile.core.database.CacheDao
import com.kaze.mobile.core.datastore.UserPreferencesRepository
import com.kaze.mobile.core.datastore.UserPrefs
import com.kaze.mobile.core.designsystem.theme.KazeThemeId
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val prefs: UserPreferencesRepository,
    private val cache: CacheDao,
) : ViewModel() {
    val state: StateFlow<UserPrefs?> = prefs.prefs.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun setTheme(id: KazeThemeId) = viewModelScope.launch { prefs.setTheme(id) }
    fun setFollowSystem(v: Boolean) = viewModelScope.launch { prefs.setFollowSystem(v) }
    fun setReducedMotion(v: Boolean) = viewModelScope.launch { prefs.setReducedMotion(v) }
    fun setAmbientEffects(v: Boolean) = viewModelScope.launch { prefs.setAmbientEffects(v) }
    fun setWallpaperAccent(v: Boolean) = viewModelScope.launch { prefs.setWallpaperAccent(v) }
    fun setHighContrast(v: Boolean) = viewModelScope.launch { prefs.setHighContrast(v) }
    fun setGamification(v: Boolean) = viewModelScope.launch { prefs.setGamification(v) }
    fun setAutoNext(v: Boolean) = viewModelScope.launch { prefs.setAutoNext(v) }
    fun setSkipIntro(v: Boolean) = viewModelScope.launch { prefs.setSkipIntroAutomatically(v) }
    fun setAmbientMode(v: Boolean) = viewModelScope.launch { prefs.setAmbientMode(v) }
    fun setAmbientIntensity(v: Float) = viewModelScope.launch { prefs.setAmbientIntensity(v) }
    fun setSubtitleScale(v: Float) = viewModelScope.launch { prefs.setSubtitleScale(v) }
    fun setSubtitleBackground(v: Boolean) = viewModelScope.launch { prefs.setSubtitleBackground(v) }
    fun setNotifySocial(v: Boolean) = viewModelScope.launch { prefs.setNotifySocial(v) }
    fun setNotifyParties(v: Boolean) = viewModelScope.launch { prefs.setNotifyParties(v) }
    fun setNotifyEpisodes(v: Boolean) = viewModelScope.launch { prefs.setNotifyEpisodes(v) }
    fun completeOnboarding(genres: Set<String>) = viewModelScope.launch { prefs.completeOnboarding(genres) }
    fun setFavoriteGenres(genres: Set<String>) = viewModelScope.launch { prefs.setFavoriteGenres(genres) }
    fun clearCache(done: () -> Unit) = viewModelScope.launch { cache.clear(); done() }
}
