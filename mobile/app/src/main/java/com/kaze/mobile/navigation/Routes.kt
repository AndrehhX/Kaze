package com.kaze.mobile.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Forum
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.VideoLibrary
import androidx.compose.material.icons.outlined.Explore
import androidx.compose.material.icons.outlined.Forum
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.VideoLibrary
import androidx.compose.ui.graphics.vector.ImageVector
import kotlinx.serialization.Serializable

// ---- Top level ----
@Serializable data object HomeRoute
@Serializable data object DiscoverRoute
@Serializable data object LibraryRoute
@Serializable data object CommunityRoute
@Serializable data object ProfileRoute

// ---- Catalogue & discovery ----
@Serializable data class AnimeRoute(val id: Int, val sharedKey: String? = null)
@Serializable data class EpisodesRoute(val id: Int)
@Serializable data class SearchRoute(val query: String = "", val genre: String? = null, val tag: String? = null)
@Serializable data class SeasonalRoute(val season: String? = null, val year: Int? = null)
@Serializable data object MoodRoute
@Serializable data object RouletteRoute
@Serializable data class SimilarityRoute(val id: Int)

// ---- Library ----
@Serializable data object CollectionsRoute
@Serializable data class CollectionRoute(val id: Long)
@Serializable data object DnaRoute
@Serializable data object HistoryRoute

// ---- Community & social ----
@Serializable data class ReviewsRoute(val animeId: Int? = null, val title: String? = null)
@Serializable data class WriteReviewRoute(val animeId: Int, val title: String)
@Serializable data object DiscussionsRoute
@Serializable data class DiscussionRoute(val id: String)
@Serializable data object FriendsRoute
@Serializable data object FriendRequestsRoute
@Serializable data class PartiesRoute(val animeId: Int = 0, val title: String = "", val cover: String? = null)
@Serializable data class PartyRoomRoute(val code: String, val animeId: Int = 0, val title: String = "", val cover: String? = null)
@Serializable data class UserProfileRoute(val userId: String)
@Serializable data object NotificationsRoute

// ---- Profile, settings & account ----
@Serializable data object ProfileStatsRoute
@Serializable data object EditProfileRoute
@Serializable data object AchievementsRoute
@Serializable data object SettingsRoute
@Serializable data object AppearanceRoute
@Serializable data object PrivacyRoute
@Serializable data object ConnectedAccountsRoute
@Serializable data object AccountRoute
@Serializable data object LoginRoute
@Serializable data object RegisterRoute
@Serializable data object PasswordRecoveryRoute
@Serializable data object NewPasswordRoute
@Serializable data object OnboardingRoute

enum class TopLevel(val route: Any, val label: String, val icon: ImageVector, val selectedIcon: ImageVector) {
    HOME(HomeRoute, "Inicio", Icons.Outlined.Home, Icons.Filled.Home),
    DISCOVER(DiscoverRoute, "Explorar", Icons.Outlined.Explore, Icons.Filled.Explore),
    LIBRARY(LibraryRoute, "Biblioteca", Icons.Outlined.VideoLibrary, Icons.Filled.VideoLibrary),
    COMMUNITY(CommunityRoute, "Comunidad", Icons.Outlined.Forum, Icons.Filled.Forum),
    PROFILE(ProfileRoute, "Perfil", Icons.Outlined.Person, Icons.Filled.Person),
}
