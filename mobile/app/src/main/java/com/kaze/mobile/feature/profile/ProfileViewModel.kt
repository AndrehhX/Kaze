package com.kaze.mobile.feature.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kaze.mobile.core.database.ActivityEventEntity
import com.kaze.mobile.core.datastore.UserPreferencesRepository
import com.kaze.mobile.core.datastore.UserPrefs
import com.kaze.mobile.core.designsystem.theme.KazeThemeId
import com.kaze.mobile.data.library.AchievementProgress
import com.kaze.mobile.data.library.AchievementsRepository
import com.kaze.mobile.data.library.LibraryRepository
import com.kaze.mobile.data.library.ProgressRepository
import com.kaze.mobile.domain.model.LibraryEntry
import com.kaze.mobile.domain.recommendation.AnimeDna
import com.kaze.mobile.domain.recommendation.AnimeDnaCalculator
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val prefsRepo: UserPreferencesRepository,
    library: LibraryRepository,
    achievementsRepo: AchievementsRepository,
    progress: ProgressRepository,
) : ViewModel() {
    val prefs: StateFlow<UserPrefs?> = prefsRepo.prefs.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
    val library: StateFlow<List<LibraryEntry>> = library.entries.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val dna: StateFlow<AnimeDna?> = library.entries.map { AnimeDnaCalculator.compute(it) }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
    val achievements: StateFlow<List<AchievementProgress>> = achievementsRepo.achievements.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val activity: StateFlow<List<ActivityEventEntity>> = achievementsRepo.recentActivity.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val demoWatchMs = progress.totalWatchMs.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0L)

    fun saveLocal(name: String, bio: String, theme: KazeThemeId?) = viewModelScope.launch {
        prefsRepo.setLocalProfile(
            com.kaze.mobile.core.text.SafeRichText.sanitizeUserInput(name, 40),
            com.kaze.mobile.core.text.SafeRichText.sanitizeUserInput(bio, 300),
            theme,
        )
    }

    fun setFavoriteGenres(g: Set<String>) = viewModelScope.launch { prefsRepo.setFavoriteGenres(g) }
}
