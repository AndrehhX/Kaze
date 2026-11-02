package com.kaze.mobile.navigation

import androidx.compose.animation.ExperimentalSharedTransitionApi
import androidx.compose.animation.SharedTransitionLayout
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.windowsizeclass.WindowWidthSizeClass
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.navDeepLink
import androidx.navigation.toRoute
import com.kaze.mobile.core.designsystem.motion.KazeMotion
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.domain.model.Anime
import com.kaze.mobile.feature.community.AniListReviewsScreen
import com.kaze.mobile.feature.community.CommunityScreen
import com.kaze.mobile.feature.community.CommunityTab
import com.kaze.mobile.feature.detail.DetailScreen
import com.kaze.mobile.feature.detail.EpisodesScreen
import com.kaze.mobile.feature.discover.DiscoverScreen
import com.kaze.mobile.feature.discover.MoodScreen
import com.kaze.mobile.feature.discover.RouletteScreen
import com.kaze.mobile.feature.discover.SearchScreen
import com.kaze.mobile.feature.discover.SeasonalScreen
import com.kaze.mobile.feature.discover.SimilarityScreen
import com.kaze.mobile.feature.home.HomeScreen
import com.kaze.mobile.feature.library.CollectionDetailScreen
import com.kaze.mobile.feature.library.CollectionsScreen
import com.kaze.mobile.feature.library.DnaScreen
import com.kaze.mobile.feature.library.HistoryScreen
import com.kaze.mobile.feature.library.LibraryScreen
import com.kaze.mobile.feature.onboarding.OnboardingScreen
import com.kaze.mobile.feature.profile.AchievementsScreen
import com.kaze.mobile.feature.profile.EditLocalProfileScreen
import com.kaze.mobile.feature.profile.ProfileScreen
import com.kaze.mobile.feature.profile.ProfileStatsScreen
import com.kaze.mobile.feature.settings.AppearanceScreen
import com.kaze.mobile.feature.settings.SettingsScreen
import com.kaze.mobile.ui.shared.LocalNavAnimatedScope
import com.kaze.mobile.ui.shared.LocalSharedTransitionScope

/** Hooks the social/backend layer plugs into the shell (kept separate so guest mode stays fully functional). */
interface SocialShell {
    @Composable fun GlobalEffects(nav: NavHostController)
    @Composable fun HomeFriendsRail(onOpenAnime: (Int) -> Unit, onFriends: () -> Unit)
    @Composable fun ProfileAccountCard(nav: NavHostController)
    @Composable fun profileIdentity(): com.kaze.mobile.feature.profile.ProfileIdentity?
    fun communityTabs(nav: NavHostController): List<CommunityTab>
    fun NavGraphBuilder.socialDestinations(nav: NavHostController, columns: Int)
    val hasAccountScreens: Boolean
}

@OptIn(ExperimentalSharedTransitionApi::class)
@Composable
fun KazeAppShell(
    nav: NavHostController,
    widthClass: WindowWidthSizeClass,
    startOnboarding: Boolean,
    social: SocialShell,
) {
    val backStack by nav.currentBackStackEntryAsState()
    val dest = backStack?.destination
    val selected = TopLevel.entries.indexOfFirst { t -> dest?.hierarchy?.any { it.hasRoute(t.route::class) } == true }
    val isTopLevel = selected >= 0
    val columns = when (widthClass) { WindowWidthSizeClass.Expanded -> 6; WindowWidthSizeClass.Medium -> 4; else -> 3 }
    val useRail = widthClass != WindowWidthSizeClass.Compact
    val motion = Kaze.style.motion
    val reduced = Kaze.reducedMotion

    fun goTop(t: TopLevel) = nav.navigate(t.route) {
        popUpTo(nav.graph.findStartDestination().id) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
    val openAnime: (Anime, String?) -> Unit = { a, key -> nav.navigate(AnimeRoute(a.id, key)) { launchSingleTop = true } }
    val openId: (Int) -> Unit = { id -> nav.navigate(AnimeRoute(id)) { launchSingleTop = true } }

    Row(Modifier.fillMaxSize()) {
        if (useRail && isTopLevel) KazeNavRail(selected, ::goTop)
        Box(Modifier.weight(1f)) {
            SharedTransitionLayout {
                CompositionLocalProvider(LocalSharedTransitionScope provides this) {
                    NavHost(
                        navController = nav,
                        startDestination = if (startOnboarding) OnboardingRoute else HomeRoute,
                        enterTransition = KazeMotion.enter(motion, reduced),
                        exitTransition = KazeMotion.exit(motion, reduced),
                        popEnterTransition = KazeMotion.popEnter(motion, reduced),
                        popExitTransition = KazeMotion.popExit(motion, reduced),
                    ) {
                        screen<OnboardingRoute> {
                            OnboardingScreen(onDone = { nav.navigate(HomeRoute) { popUpTo(OnboardingRoute) { inclusive = true } } })
                        }
                        screen<HomeRoute> {
                            HomeScreen(
                                onOpenAnime = openAnime,
                                onSearch = { nav.navigate(SearchRoute()) },
                                onNotifications = { nav.navigate(NotificationsRoute) },
                                onSeasonal = { nav.navigate(SeasonalRoute()) },
                                onSeeAll = { genre -> nav.navigate(SearchRoute(genre = genre)) },
                                friendsSection = { social.HomeFriendsRail(openId) { nav.navigate(FriendsRoute) } },
                            )
                        }
                        screen<DiscoverRoute> {
                            DiscoverScreen(
                                columns = (columns / 1.5).toInt().coerceAtLeast(2),
                                onSearch = { nav.navigate(SearchRoute()) },
                                onGenre = { nav.navigate(SearchRoute(genre = it)) },
                                onMood = { nav.navigate(MoodRoute) },
                                onRoulette = { nav.navigate(RouletteRoute) },
                                onSeasonal = { nav.navigate(SeasonalRoute()) },
                                onSimilarity = { nav.navigate(SimilarityRoute(LIBRARY_SEED_FALLBACK)) },
                                onDna = { nav.navigate(DnaRoute) },
                            )
                        }
                        screen<LibraryRoute> {
                            LibraryScreen(
                                columns = columns, onOpen = openId,
                                onCollections = { nav.navigate(CollectionsRoute) }, onDna = { nav.navigate(DnaRoute) },
                                onHistory = { nav.navigate(HistoryRoute) }, onSync = { nav.navigate(ConnectedAccountsRoute) },
                                onBrowse = { goTop(TopLevel.DISCOVER) },
                            )
                        }
                        screen<CommunityRoute> { CommunityScreen(onOpenAnime = openId, extraTabs = social.communityTabs(nav)) }
                        screen<ProfileRoute> {
                            ProfileScreen(
                                identity = social.profileIdentity(),
                                onSettings = { nav.navigate(SettingsRoute) },
                                onEdit = { nav.navigate(EditProfileRoute) },
                                onAchievements = { nav.navigate(AchievementsRoute) },
                                onStats = { nav.navigate(ProfileStatsRoute) },
                                onFriends = { nav.navigate(FriendsRoute) },
                                onOpenAnime = openId,
                                accountCard = { social.ProfileAccountCard(nav) },
                            )
                        }

                        screen<AnimeRoute>(deepLinks = listOf(navDeepLink<AnimeRoute>(basePath = "kaze://anime"))) {
                            DetailScreen(
                                onBack = { nav.popBackStack() },
                                onOpenAnime = openAnime,
                                onEpisodes = { nav.navigate(EpisodesRoute(it)) },
                                onGenre = { nav.navigate(SearchRoute(genre = it)) },
                                onTag = { nav.navigate(SearchRoute(tag = it)) },
                                onReviews = { id, title -> nav.navigate(ReviewsRoute(id, title)) },
                                onWriteReview = { id, title -> nav.navigate(WriteReviewRoute(id, title)) },
                                onSimilarity = { nav.navigate(SimilarityRoute(it)) },
                                onWatchTogether = { a -> nav.navigate(PartiesRoute(a.id, a.displayTitle, a.coverUrl)) },
                                expanded = widthClass == WindowWidthSizeClass.Expanded,
                            )
                        }
                        screen<EpisodesRoute> { EpisodesScreen(onBack = { nav.popBackStack() }) }
                        screen<SearchRoute> { SearchScreen(onBack = { nav.popBackStack() }, onOpenAnime = openAnime, columns = columns) }
                        screen<SeasonalRoute> { SeasonalScreen(onBack = { nav.popBackStack() }, onOpenAnime = openAnime, columns = columns) }
                        screen<MoodRoute> { MoodScreen(onBack = { nav.popBackStack() }, onOpenAnime = openAnime) }
                        screen<RouletteRoute> { RouletteScreen(onBack = { nav.popBackStack() }, onOpenAnime = openAnime) }
                        screen<SimilarityRoute> { SimilarityScreen(onBack = { nav.popBackStack() }, onOpenAnime = openAnime) }
                        screen<CollectionsRoute> { CollectionsScreen(onBack = { nav.popBackStack() }, onOpen = { nav.navigate(CollectionRoute(it)) }) }
                        screen<CollectionRoute> { CollectionDetailScreen(onBack = { nav.popBackStack() }, onOpenAnime = openId) }
                        screen<DnaRoute> { DnaScreen(onBack = { nav.popBackStack() }, onBrowse = { goTop(TopLevel.DISCOVER) }) }
                        screen<HistoryRoute> { HistoryScreen(onBack = { nav.popBackStack() }, onOpen = openId) }
                        screen<ReviewsRoute> { entry ->
                            AniListReviewsScreen(entry.toRoute<ReviewsRoute>().title, onBack = { nav.popBackStack() }, onOpenAnime = openId)
                        }
                        screen<AchievementsRoute> { AchievementsScreen(onBack = { nav.popBackStack() }) }
                        screen<ProfileStatsRoute> { ProfileStatsScreen(onBack = { nav.popBackStack() }) }
                        screen<SettingsRoute> {
                            SettingsScreen(
                                onBack = { nav.popBackStack() },
                                onAppearance = { nav.navigate(AppearanceRoute) },
                                onPrivacy = if (social.hasAccountScreens) ({ nav.navigate(PrivacyRoute) }) else null,
                                onConnected = if (social.hasAccountScreens) ({ nav.navigate(ConnectedAccountsRoute) }) else null,
                                onAccount = if (social.hasAccountScreens) ({ nav.navigate(AccountRoute) }) else null,
                            )
                        }
                        screen<AppearanceRoute> { AppearanceScreen(onBack = { nav.popBackStack() }) }
                        if (!social.hasAccountScreens) screen<EditProfileRoute> { EditLocalProfileScreen(onBack = { nav.popBackStack() }) }
                        with(social) { socialDestinations(nav, columns) }
                    }
                }
            }
            social.GlobalEffects(nav)
            if (!useRail) {
                androidx.compose.animation.AnimatedVisibility(
                    visible = isTopLevel,
                    modifier = Modifier.align(Alignment.BottomCenter),
                    enter = slideInVertically { it } + fadeIn(),
                    exit = slideOutVertically { it } + fadeOut(),
                ) { KazeBottomBar(selected.coerceAtLeast(0), ::goTop) }
            }
        }
    }
}

/** Similarity Explorer opened from Discover starts from Frieren (AniList id 154587) unless a title is chosen. */
const val LIBRARY_SEED_FALLBACK = 154587

/** composable<T> that also publishes its AnimatedVisibilityScope for shared-element transitions. */
inline fun <reified T : Any> NavGraphBuilder.screen(
    deepLinks: List<androidx.navigation.NavDeepLink> = emptyList(),
    noinline content: @Composable (androidx.navigation.NavBackStackEntry) -> Unit,
) {
    composable<T>(deepLinks = deepLinks) { entry ->
        CompositionLocalProvider(LocalNavAnimatedScope provides this) { content(entry) }
    }
}
