package com.kaze.mobile.feature.social

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Theaters
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.navDeepLink
import com.kaze.mobile.core.designsystem.components.KazeButton
import com.kaze.mobile.core.designsystem.components.KazeCard
import com.kaze.mobile.core.designsystem.components.KazeChip
import com.kaze.mobile.core.designsystem.components.SectionHeader
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.core.designsystem.theme.KazeThemeId
import com.kaze.mobile.data.backend.AuthEvent
import com.kaze.mobile.data.backend.AuthState
import com.kaze.mobile.data.backend.SupabaseConfig
import com.kaze.mobile.feature.auth.AccountScreen
import com.kaze.mobile.feature.auth.LoginScreen
import com.kaze.mobile.feature.auth.NewPasswordScreen
import com.kaze.mobile.feature.auth.PasswordRecoveryScreen
import com.kaze.mobile.feature.auth.RegisterScreen
import com.kaze.mobile.feature.community.CommunityTab
import com.kaze.mobile.feature.community.DiscussionDetailScreen
import com.kaze.mobile.feature.community.DiscussionsTab
import com.kaze.mobile.feature.community.FriendsFeedTab
import com.kaze.mobile.feature.community.KazeReviewsTab
import com.kaze.mobile.feature.community.WriteReviewScreen
import com.kaze.mobile.feature.party.WatchPartiesScreen
import com.kaze.mobile.feature.party.WatchPartyRoomScreen
import com.kaze.mobile.feature.profile.EditLocalProfileScreen
import com.kaze.mobile.feature.profile.ProfileIdentity
import com.kaze.mobile.navigation.AccountRoute
import com.kaze.mobile.navigation.AnimeRoute
import com.kaze.mobile.navigation.ConnectedAccountsRoute
import com.kaze.mobile.navigation.DiscussionRoute
import com.kaze.mobile.navigation.DiscussionsRoute
import com.kaze.mobile.navigation.EditProfileRoute
import com.kaze.mobile.navigation.FriendRequestsRoute
import com.kaze.mobile.navigation.FriendsRoute
import com.kaze.mobile.navigation.LoginRoute
import com.kaze.mobile.navigation.NewPasswordRoute
import com.kaze.mobile.navigation.NotificationsRoute
import com.kaze.mobile.navigation.PartiesRoute
import com.kaze.mobile.navigation.PartyRoomRoute
import com.kaze.mobile.navigation.PasswordRecoveryRoute
import com.kaze.mobile.navigation.PrivacyRoute
import com.kaze.mobile.navigation.ProfileRoute
import com.kaze.mobile.navigation.RegisterRoute
import com.kaze.mobile.navigation.SocialShell
import com.kaze.mobile.navigation.UserProfileRoute
import com.kaze.mobile.navigation.WriteReviewRoute
import com.kaze.mobile.navigation.screen
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SocialShellImpl @Inject constructor() : SocialShell {

    private val configured = SupabaseConfig.fromBuildConfig().isConfigured
    override val hasAccountScreens: Boolean = true

    @Composable
    private fun session(): SessionViewModel = hiltViewModel(androidx.activity.compose.LocalActivity.current as androidx.activity.ComponentActivity)

    @Composable
    override fun GlobalEffects(nav: NavHostController) {
        val vm = session()
        val snackbar = remember { SnackbarHostState() }
        LaunchedEffect(Unit) {
            vm.authEvents.collect { e ->
                when (e) {
                    AuthEvent.PasswordRecovery -> nav.navigate(NewPasswordRoute)
                    AuthEvent.EmailVerified -> snackbar.showSnackbar("Email confirmed — you're signed in.")
                    is AuthEvent.Failed -> snackbar.showSnackbar(e.message)
                }
            }
        }
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) { SnackbarHost(snackbar, Modifier.padding(top = 48.dp)) }
    }

    @Composable
    override fun HomeFriendsRail(onOpenAnime: (Int) -> Unit, onFriends: () -> Unit) {
        val auth by session().auth.collectAsStateWithLifecycle()
        Column {
            SectionHeader("Friends are watching", index = 10)
            if (auth !is AuthState.SignedIn) {
                KazeCard(Modifier.fillMaxWidth().padding(horizontal = 20.dp), onClick = onFriends) {
                    Text(
                        if (configured) "Inicia sesión y añade amigos para ver lo que están viendo — solo actividad compartida."
                        else "Friends need a KAZE backend. This build runs in guest mode, so no social activity is shown.",
                        style = Kaze.type.body, color = Kaze.colors.textMuted,
                    )
                }
            } else {
                val feed: FeedViewModel = hiltViewModel()
                val state by feed.feed.collectAsStateWithLifecycle()
                val items = state.data.orEmpty().take(6)
                if (items.isEmpty()) Text("No shared activity from friends yet.", style = Kaze.type.body, color = Kaze.colors.textMuted, modifier = Modifier.padding(horizontal = 20.dp))
                items.forEach { ActivityRow(it, onOpenAnime, showUser = true) }
            }
        }
    }

    @Composable
    override fun ProfileAccountCard(nav: NavHostController) {
        val vm = session()
        val auth by vm.auth.collectAsStateWithLifecycle()
        val incoming by vm.incomingRequests.collectAsStateWithLifecycle()
        val c = Kaze.colors
        when (val s = auth) {
            is AuthState.SignedIn -> Row(Modifier.padding(horizontal = 16.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                KazeChip("Friends", icon = Icons.Filled.Group, onClick = { nav.navigate(FriendsRoute) })
                KazeChip("Requests $incoming", icon = Icons.Filled.PersonAdd, selected = incoming > 0, onClick = { nav.navigate(FriendRequestsRoute) })
                KazeChip("Inbox", icon = Icons.Filled.Notifications, onClick = { nav.navigate(NotificationsRoute) })
                KazeChip("Parties", icon = Icons.Filled.Theaters, onClick = { nav.navigate(PartiesRoute()) })
                if (!s.emailVerified) Text("Verify email", style = Kaze.type.label, color = c.warning)
            }
            else -> KazeCard(Modifier.fillMaxWidth().padding(16.dp)) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Make KAZE social", style = Kaze.type.title, color = c.text)
                    Text(
                        if (configured) "Crea una cuenta para sincronizar tu biblioteca, añadir amigos, reseñar animes y crear salas compartidas."
                        else "This build has no KAZE backend configured, so you're in guest mode: everything local works offline.",
                        style = Kaze.type.bodySmall, color = c.textMuted,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (configured) KazeButton("Sign in", { nav.navigate(LoginRoute) })
                        KazeButton("Sala compartida de prueba", { nav.navigate(PartiesRoute()) }, kind = com.kaze.mobile.core.designsystem.components.KazeButtonKind.Secondary)
                    }
                }
            }
        }
    }

    @Composable
    override fun profileIdentity(): ProfileIdentity? {
        val vm = session()
        val p by vm.profile.collectAsStateWithLifecycle()
        val auth by vm.auth.collectAsStateWithLifecycle()
        if (auth !is AuthState.SignedIn) return null
        val profile = p ?: return null
        return ProfileIdentity(profile.name, profile.username, profile.bio, profile.avatarUrl, profile.bannerUrl, profile.profileTheme?.let(KazeThemeId::fromKey), isGuest = false)
    }

    override fun communityTabs(nav: NavHostController): List<CommunityTab> = listOf(
        CommunityTab("Friends") { val s by session().auth.collectAsStateWithLifecycle(); FriendsFeedTab(s is AuthState.SignedIn, { nav.navigate(LoginRoute) }, { nav.navigate(AnimeRoute(it)) }, { nav.navigate(FriendsRoute) }) },
        CommunityTab("KAZE reviews") { val s by session().auth.collectAsStateWithLifecycle(); KazeReviewsTab(s is AuthState.SignedIn, { nav.navigate(LoginRoute) }, { nav.navigate(AnimeRoute(it)) }, { nav.navigate(UserProfileRoute(it)) }) },
        CommunityTab("Discussions") { val s by session().auth.collectAsStateWithLifecycle(); DiscussionsTab(s is AuthState.SignedIn, { nav.navigate(LoginRoute) }, { nav.navigate(DiscussionRoute(it)) }) },
        CommunityTab("Salas compartidas") { PartiesEntry(nav) },
    )

    @Composable
    private fun PartiesEntry(nav: NavHostController) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Miren juntos en sincronía, con chat y reacciones.", style = Kaze.type.body, color = Kaze.colors.textMuted)
            KazeButton("Abrir salas compartidas", { nav.navigate(PartiesRoute()) }, icon = Icons.Filled.Theaters)
        }
    }

    override fun NavGraphBuilder.socialDestinations(nav: NavHostController, columns: Int) {
        val back: () -> Unit = { nav.popBackStack() }
        screen<LoginRoute> { LoginScreen(back, { nav.navigate(RegisterRoute) }, { nav.navigate(PasswordRecoveryRoute) }, { nav.popBackStack(ProfileRoute, inclusive = false) || nav.popBackStack() }) }
        screen<RegisterRoute> { RegisterScreen(back, { nav.popBackStack(ProfileRoute, inclusive = false) || nav.popBackStack() }) }
        screen<PasswordRecoveryRoute> { PasswordRecoveryScreen(back) }
        screen<NewPasswordRoute> { NewPasswordScreen(onDone = back) }
        screen<AccountRoute> { AccountScreen(back, { nav.navigate(LoginRoute) }, { nav.popBackStack(ProfileRoute, inclusive = false) }) }
        screen<PrivacyRoute> { val s by session().auth.collectAsStateWithLifecycle(); PrivacyScreen(back, s is AuthState.SignedIn) }
        screen<ConnectedAccountsRoute> { ConnectedAccountsScreen(back) }
        screen<EditProfileRoute> {
            val s by session().auth.collectAsStateWithLifecycle()
            if (s is AuthState.SignedIn) EditProfileScreen(back) else EditLocalProfileScreen(back)
        }
        screen<FriendsRoute> {
            val s by session().auth.collectAsStateWithLifecycle()
            FriendsScreen(back, { nav.navigate(UserProfileRoute(it)) }, { nav.navigate(FriendRequestsRoute) }, { nav.navigate(LoginRoute) }, s is AuthState.SignedIn, configured)
        }
        screen<FriendRequestsRoute> { FriendRequestsScreen(back, { nav.navigate(UserProfileRoute(it)) }) }
        screen<UserProfileRoute>(deepLinks = listOf(navDeepLink<UserProfileRoute>(basePath = "kaze://user"))) {
            UserProfileScreen(back, { nav.navigate(AnimeRoute(it)) }, { nav.navigate(UserProfileRoute(it)) })
        }
        screen<NotificationsRoute>(deepLinks = listOf(navDeepLink<NotificationsRoute>(basePath = "kaze://notifications"))) {
            val s by session().auth.collectAsStateWithLifecycle()
            NotificationsScreen(back, { target ->
                val (kind, id) = target.split(":", limit = 2).let { it[0] to it.getOrElse(1) { "" } }
                when {
                    id.isBlank() -> Unit
                    kind == "party" -> nav.navigate(PartyRoomRoute(id))
                    kind == "user" -> nav.navigate(UserProfileRoute(id))
                    kind == "discussion" -> nav.navigate(DiscussionRoute(id))
                }
            }, s is AuthState.SignedIn, { nav.navigate(LoginRoute) }, configured)
        }
        screen<DiscussionsRoute> {
            val s by session().auth.collectAsStateWithLifecycle()
            Column { com.kaze.mobile.core.designsystem.components.KazeTopBar("Discussions", back); DiscussionsTab(s is AuthState.SignedIn, { nav.navigate(LoginRoute) }, { nav.navigate(DiscussionRoute(it)) }) }
        }
        screen<DiscussionRoute> { DiscussionDetailScreen(back, { nav.navigate(UserProfileRoute(it)) }) }
        screen<WriteReviewRoute> { val s by session().auth.collectAsStateWithLifecycle(); WriteReviewScreen(back, s is AuthState.SignedIn, { nav.navigate(LoginRoute) }) }
        screen<PartiesRoute> {
            WatchPartiesScreen(back, { code, animeId, title, cover -> nav.navigate(PartyRoomRoute(code, animeId, title, cover)) }, configured)
        }
        screen<PartyRoomRoute>(deepLinks = listOf(navDeepLink<PartyRoomRoute>(basePath = "kaze://party"))) { WatchPartyRoomScreen(back) }
    }
}

@Module
@InstallIn(SingletonComponent::class)
abstract class SocialShellModule {
    @Binds abstract fun bind(impl: SocialShellImpl): SocialShell
}

