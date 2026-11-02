package com.kaze.mobile.core.datastore

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.kaze.mobile.core.designsystem.theme.KazeThemeId
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "kaze_prefs")

data class UserPrefs(
    val theme: KazeThemeId = KazeThemeId.MIDNIGHT_NEON,
    val followSystem: Boolean = false,
    val darkTheme: KazeThemeId = KazeThemeId.MIDNIGHT_NEON,
    val lightTheme: KazeThemeId = KazeThemeId.SAKURA_DREAM,
    val reducedMotion: Boolean = false,
    val ambientEffects: Boolean = true,
    val wallpaperAccent: Boolean = false,
    val highContrast: Boolean = false,
    val onboardingDone: Boolean = false,
    val gamificationEnabled: Boolean = true,
    val favoriteGenres: Set<String> = emptySet(),
    val savedSearches: List<String> = emptyList(),
    // Playback
    val playbackSpeed: Float = 1f,
    val autoNext: Boolean = true,
    val ambientMode: Boolean = true,
    val ambientIntensity: Float = 0.6f,
    val subtitleScale: Float = 1f,
    val subtitleBackground: Boolean = true,
    val preferredSubtitleLanguage: String? = "en",
    val skipIntroAutomatically: Boolean = false,
    // Notifications
    val notifySocial: Boolean = true,
    val notifyParties: Boolean = true,
    val notifyEpisodes: Boolean = true,
    // Local (guest) profile
    val localDisplayName: String = "",
    val localBio: String = "",
    val profileTheme: KazeThemeId? = null,
) {
    fun effectiveTheme(systemDark: Boolean): KazeThemeId =
        if (followSystem) (if (systemDark) darkTheme else lightTheme) else theme
}

@Singleton
class UserPreferencesRepository @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private object K {
        val theme = stringPreferencesKey("theme")
        val followSystem = booleanPreferencesKey("follow_system")
        val darkTheme = stringPreferencesKey("dark_theme")
        val lightTheme = stringPreferencesKey("light_theme")
        val reducedMotion = booleanPreferencesKey("reduced_motion")
        val ambientEffects = booleanPreferencesKey("ambient_effects")
        val wallpaperAccent = booleanPreferencesKey("wallpaper_accent")
        val highContrast = booleanPreferencesKey("high_contrast")
        val onboardingDone = booleanPreferencesKey("onboarding_done")
        val gamification = booleanPreferencesKey("gamification")
        val favoriteGenres = stringSetPreferencesKey("favorite_genres")
        val savedSearches = stringPreferencesKey("saved_searches")
        val playbackSpeed = floatPreferencesKey("playback_speed")
        val autoNext = booleanPreferencesKey("auto_next")
        val ambientMode = booleanPreferencesKey("ambient_mode")
        val ambientIntensity = floatPreferencesKey("ambient_intensity")
        val subtitleScale = floatPreferencesKey("subtitle_scale")
        val subtitleBackground = booleanPreferencesKey("subtitle_background")
        val subtitleLanguage = stringPreferencesKey("subtitle_language")
        val skipIntro = booleanPreferencesKey("skip_intro_auto")
        val notifySocial = booleanPreferencesKey("notify_social")
        val notifyParties = booleanPreferencesKey("notify_parties")
        val notifyEpisodes = booleanPreferencesKey("notify_episodes")
        val localName = stringPreferencesKey("local_name")
        val localBio = stringPreferencesKey("local_bio")
        val profileTheme = stringPreferencesKey("profile_theme")
    }

    val prefs: Flow<UserPrefs> = context.dataStore.data
        .catch { if (it is IOException) emit(androidx.datastore.preferences.core.emptyPreferences()) else throw it }
        .map { p ->
            UserPrefs(
                theme = KazeThemeId.fromKey(p[K.theme]),
                followSystem = p[K.followSystem] ?: false,
                darkTheme = p[K.darkTheme]?.let(KazeThemeId::fromKey) ?: KazeThemeId.MIDNIGHT_NEON,
                lightTheme = p[K.lightTheme]?.let(KazeThemeId::fromKey) ?: KazeThemeId.SAKURA_DREAM,
                reducedMotion = p[K.reducedMotion] ?: false,
                ambientEffects = p[K.ambientEffects] ?: true,
                wallpaperAccent = p[K.wallpaperAccent] ?: false,
                highContrast = p[K.highContrast] ?: false,
                onboardingDone = p[K.onboardingDone] ?: false,
                gamificationEnabled = p[K.gamification] ?: true,
                favoriteGenres = p[K.favoriteGenres] ?: emptySet(),
                savedSearches = p[K.savedSearches]?.split('\u001F')?.filter { it.isNotBlank() } ?: emptyList(),
                playbackSpeed = p[K.playbackSpeed] ?: 1f,
                autoNext = p[K.autoNext] ?: true,
                ambientMode = p[K.ambientMode] ?: true,
                ambientIntensity = p[K.ambientIntensity] ?: 0.6f,
                subtitleScale = p[K.subtitleScale] ?: 1f,
                subtitleBackground = p[K.subtitleBackground] ?: true,
                preferredSubtitleLanguage = p[K.subtitleLanguage] ?: "en",
                skipIntroAutomatically = p[K.skipIntro] ?: false,
                notifySocial = p[K.notifySocial] ?: true,
                notifyParties = p[K.notifyParties] ?: true,
                notifyEpisodes = p[K.notifyEpisodes] ?: true,
                localDisplayName = p[K.localName] ?: "",
                localBio = p[K.localBio] ?: "",
                profileTheme = p[K.profileTheme]?.let(KazeThemeId::fromKey),
            )
        }

    suspend fun setTheme(id: KazeThemeId) = context.dataStore.edit {
        it[K.theme] = id.name
        // Keep system-follow pairs coherent with the latest explicit choice.
        if (id.isDark) it[K.darkTheme] = id.name else it[K.lightTheme] = id.name
    }
    suspend fun setFollowSystem(v: Boolean) = context.dataStore.edit { it[K.followSystem] = v }
    suspend fun setReducedMotion(v: Boolean) = context.dataStore.edit { it[K.reducedMotion] = v }
    suspend fun setAmbientEffects(v: Boolean) = context.dataStore.edit { it[K.ambientEffects] = v }
    suspend fun setWallpaperAccent(v: Boolean) = context.dataStore.edit { it[K.wallpaperAccent] = v }
    suspend fun setHighContrast(v: Boolean) = context.dataStore.edit { it[K.highContrast] = v }
    suspend fun completeOnboarding(genres: Set<String>) = context.dataStore.edit {
        it[K.onboardingDone] = true
        it[K.favoriteGenres] = genres
    }
    suspend fun setFavoriteGenres(genres: Set<String>) = context.dataStore.edit { it[K.favoriteGenres] = genres }
    suspend fun setGamification(v: Boolean) = context.dataStore.edit { it[K.gamification] = v }

    suspend fun addSavedSearch(query: String) = context.dataStore.edit {
        val q = query.trim().take(80)
        if (q.isEmpty()) return@edit
        val current = it[K.savedSearches]?.split('\u001F')?.filter { s -> s.isNotBlank() } ?: emptyList()
        it[K.savedSearches] = (listOf(q) + current.filterNot { s -> s.equals(q, true) }).take(12).joinToString("\u001F")
    }
    suspend fun clearSavedSearches() = context.dataStore.edit { it.remove(K.savedSearches) }

    suspend fun setPlaybackSpeed(v: Float) = context.dataStore.edit { it[K.playbackSpeed] = v }
    suspend fun setAutoNext(v: Boolean) = context.dataStore.edit { it[K.autoNext] = v }
    suspend fun setAmbientMode(v: Boolean) = context.dataStore.edit { it[K.ambientMode] = v }
    suspend fun setAmbientIntensity(v: Float) = context.dataStore.edit { it[K.ambientIntensity] = v.coerceIn(0f, 1f) }
    suspend fun setSubtitleScale(v: Float) = context.dataStore.edit { it[K.subtitleScale] = v.coerceIn(0.6f, 2f) }
    suspend fun setSubtitleBackground(v: Boolean) = context.dataStore.edit { it[K.subtitleBackground] = v }
    suspend fun setSubtitleLanguage(v: String?) = context.dataStore.edit { if (v == null) it.remove(K.subtitleLanguage) else it[K.subtitleLanguage] = v }
    suspend fun setSkipIntroAutomatically(v: Boolean) = context.dataStore.edit { it[K.skipIntro] = v }
    suspend fun setNotifySocial(v: Boolean) = context.dataStore.edit { it[K.notifySocial] = v }
    suspend fun setNotifyParties(v: Boolean) = context.dataStore.edit { it[K.notifyParties] = v }
    suspend fun setNotifyEpisodes(v: Boolean) = context.dataStore.edit { it[K.notifyEpisodes] = v }
    suspend fun setLocalProfile(name: String, bio: String, theme: KazeThemeId?) = context.dataStore.edit {
        it[K.localName] = name
        it[K.localBio] = bio
        if (theme == null) it.remove(K.profileTheme) else it[K.profileTheme] = theme.name
    }
}
