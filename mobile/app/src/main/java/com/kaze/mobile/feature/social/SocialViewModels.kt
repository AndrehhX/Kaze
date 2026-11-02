package com.kaze.mobile.feature.social

import android.content.Context
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.toRoute
import com.kaze.mobile.core.common.KazeError
import com.kaze.mobile.core.common.Outcome
import com.kaze.mobile.data.backend.AniListAuthRepository
import com.kaze.mobile.data.backend.AniListSyncPreview
import com.kaze.mobile.data.backend.AuthRepository
import com.kaze.mobile.data.backend.AuthState
import com.kaze.mobile.data.backend.CloudLibraryRepository
import com.kaze.mobile.data.backend.PostgresSubscription
import com.kaze.mobile.data.backend.RealtimeClient
import com.kaze.mobile.data.backend.RealtimeEvent
import com.kaze.mobile.data.backend.SocialRepository
import com.kaze.mobile.data.library.ActivityTypes
import com.kaze.mobile.data.library.LibraryRepository
import com.kaze.mobile.domain.social.Activity
import com.kaze.mobile.domain.social.AppNotification
import com.kaze.mobile.domain.social.Block
import com.kaze.mobile.domain.social.Comment
import com.kaze.mobile.domain.social.Discussion
import com.kaze.mobile.domain.social.FriendRequest
import com.kaze.mobile.domain.social.Profile
import com.kaze.mobile.domain.social.Review
import com.kaze.mobile.domain.sync.ConflictChoice
import com.kaze.mobile.domain.sync.SyncPlan
import com.kaze.mobile.navigation.DiscussionRoute
import com.kaze.mobile.navigation.UserProfileRoute
import com.kaze.mobile.navigation.WriteReviewRoute
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class Remote<T>(val data: T? = null, val loading: Boolean = true, val error: KazeError? = null)

private suspend fun <T> MutableStateFlow<Remote<T>>.load(block: suspend () -> Outcome<T>) {
    update { it.copy(loading = true, error = null) }
    when (val r = block()) {
        is Outcome.Success -> value = Remote(r.value, loading = false)
        is Outcome.Failure -> update { it.copy(loading = false, error = r.error) }
    }
}

/** App-wide session info for the shell (profile header, account card, rails). */
@HiltViewModel
class SessionViewModel @Inject constructor(auth: AuthRepository, private val social: SocialRepository) : ViewModel() {
    val auth: StateFlow<AuthState> = auth.state
    val profile: StateFlow<Profile?> = social.myProfile.stateIn(viewModelScope, SharingStarted.Eagerly, null)
    private val _incoming = MutableStateFlow(0)
    val incomingRequests = _incoming.asStateFlow()
    val authEvents = auth.events

    init {
        viewModelScope.launch {
            auth.state.collect { s ->
                if (s is AuthState.SignedIn) {
                    social.loadMyProfile()
                    (social.incomingRequests() as? Outcome.Success)?.let { _incoming.value = it.value.size }
                }
            }
        }
    }
}

@HiltViewModel
class FriendsViewModel @Inject constructor(private val social: SocialRepository) : ViewModel() {
    val friends = MutableStateFlow(Remote<List<Profile>>())
    val incoming = MutableStateFlow(Remote<List<FriendRequest>>())
    val outgoing = MutableStateFlow(Remote<List<FriendRequest>>())
    val blocked = MutableStateFlow(Remote<List<Block>>())
    val search = MutableStateFlow(Remote<List<Profile>>(emptyList(), loading = false))
    private val _messages = Channel<String>(Channel.BUFFERED)
    val messages = _messages.receiveAsFlow()

    init { refresh() }

    fun refresh() = viewModelScope.launch {
        launch { friends.load { social.friends() } }
        launch { incoming.load { social.incomingRequests() } }
        launch { outgoing.load { social.outgoingRequests() } }
        launch { blocked.load { social.blocked() } }
    }

    fun search(q: String) = viewModelScope.launch { search.load { social.searchUsers(q) } }

    private fun act(msg: String, block: suspend () -> Outcome<Unit>) = viewModelScope.launch {
        when (val r = block()) {
            is Outcome.Success -> { _messages.send(msg); refresh() }
            is Outcome.Failure -> _messages.send(r.error.userMessage)
        }
    }

    fun send(p: Profile) = act("Request sent to ${p.name}") { social.sendFriendRequest(p.id) }
    fun accept(r: FriendRequest) = act("You're now friends") { social.respond(r.id, true) }
    fun reject(r: FriendRequest) = act("Request declined") { social.respond(r.id, false) }
    fun cancel(r: FriendRequest) = act("Request cancelled") { social.cancelRequest(r.id) }
    fun remove(p: Profile) = act("Removed ${p.name}") { social.removeFriend(p.id) }
    fun block(p: Profile) = act("Blocked ${p.name}") { social.block(p.id) }
    fun unblock(id: String) = act("Unblocked") { social.unblock(id) }
}

@HiltViewModel
class UserProfileViewModel @Inject constructor(savedState: SavedStateHandle, private val social: SocialRepository) : ViewModel() {
    val userId = savedState.toRoute<UserProfileRoute>().userId
    val profile = MutableStateFlow(Remote<Profile>())
    val relationship = MutableStateFlow(Remote<SocialRepository.Relationship>())
    val mutuals = MutableStateFlow(Remote<List<Profile>>())
    val activity = MutableStateFlow(Remote<List<Activity>>())
    private val _messages = Channel<String>(Channel.BUFFERED)
    val messages = _messages.receiveAsFlow()

    init { refresh() }

    fun refresh() = viewModelScope.launch {
        launch { profile.load { social.profile(userId) } }
        launch { relationship.load { social.relationship(userId) } }
        launch { mutuals.load { social.mutualFriends(userId) } }
        launch { activity.load { social.userActivity(userId) } }
    }

    private fun act(msg: String, block: suspend () -> Outcome<Unit>) = viewModelScope.launch {
        when (val r = block()) { is Outcome.Success -> { _messages.send(msg); refresh() }; is Outcome.Failure -> _messages.send(r.error.userMessage) }
    }
    fun addFriend() = act("Friend request sent") { social.sendFriendRequest(userId) }
    fun accept(r: FriendRequest) = act("You're now friends") { social.respond(r.id, true) }
    fun cancel(r: FriendRequest) = act("Request cancelled") { social.cancelRequest(r.id) }
    fun removeFriend() = act("Friend removed") { social.removeFriend(userId) }
    fun block() = act("User blocked") { social.block(userId) }
    fun unblock() = act("User unblocked") { social.unblock(userId) }
    fun report(reason: String) = act("Report sent to moderators") { social.report("profile", userId, reason) }
}

@HiltViewModel
class NotificationsViewModel @Inject constructor(
    private val social: SocialRepository,
    realtime: RealtimeClient,
    auth: AuthRepository,
) : ViewModel() {
    val items = MutableStateFlow(Remote<List<AppNotification>>())
    private val channel = (auth.state.value as? AuthState.SignedIn)?.user?.id?.let { me ->
        realtime.channel("notifications:$me", listOf(PostgresSubscription("INSERT", "notifications", "user_id=eq.$me")), presenceKey = null)
    }

    init {
        refresh()
        channel?.let { ch ->
            ch.connect()
            viewModelScope.launch { ch.events.collect { if (it is RealtimeEvent.PostgresChange) refresh() } }
        }
    }

    fun refresh() = viewModelScope.launch { if (social.isAvailable) items.load { social.notifications() } else items.value = Remote(emptyList(), false) }
    fun markRead(n: AppNotification?) = viewModelScope.launch { social.markRead(n?.id); refresh() }
    override fun onCleared() { channel?.close() }
}

@HiltViewModel
class FeedViewModel @Inject constructor(private val social: SocialRepository) : ViewModel() {
    val feed = MutableStateFlow(Remote<List<Activity>>())
    init { refresh() }
    fun refresh() = viewModelScope.launch { if (social.isAvailable) feed.load { social.friendsActivity() } else feed.value = Remote(emptyList(), false) }
}

@HiltViewModel
class KazeReviewsViewModel @Inject constructor(private val social: SocialRepository) : ViewModel() {
    val reviews = MutableStateFlow(Remote<List<Review>>())
    val liked = MutableStateFlow<Set<String>>(emptySet())
    private val _messages = Channel<String>(Channel.BUFFERED)
    val messages = _messages.receiveAsFlow()

    init { refresh() }
    fun refresh() = viewModelScope.launch {
        if (!social.isAvailable) { reviews.value = Remote(emptyList(), false); return@launch }
        reviews.load { social.reviews() }
        (social.myLikes() as? Outcome.Success)?.let { liked.value = it.value }
    }
    fun like(r: Review) = viewModelScope.launch {
        when (val res = social.toggleLike("review", r.id)) {
            is Outcome.Success -> { liked.update { if (res.value) it + "review:${r.id}" else it - "review:${r.id}" }; reviews.update { s -> s.copy(data = s.data?.map { if (it.id == r.id) it.copy(likeCount = it.likeCount + if (res.value) 1 else -1) else it }) } }
            is Outcome.Failure -> _messages.send(res.error.userMessage)
        }
    }
    fun report(r: Review, reason: String) = viewModelScope.launch {
        _messages.send(if (social.report("review", r.id, reason) is Outcome.Success) "Reported. Thanks for keeping KAZE kind." else "Couldn't send report")
    }
}

@HiltViewModel
class DiscussionsViewModel @Inject constructor(private val social: SocialRepository) : ViewModel() {
    val discussions = MutableStateFlow(Remote<List<Discussion>>())
    private val _created = Channel<String>(Channel.BUFFERED)
    val created = _created.receiveAsFlow()
    val error = MutableStateFlow<String?>(null)
    init { refresh() }
    fun refresh() = viewModelScope.launch { if (social.isAvailable) discussions.load { social.discussions() } else discussions.value = Remote(emptyList(), false) }
    fun create(title: String, body: String, spoilers: Boolean) = viewModelScope.launch {
        when (val r = social.createDiscussion(title, body, spoilers, null, null)) {
            is Outcome.Success -> { error.value = null; _created.send(r.value); refresh() }
            is Outcome.Failure -> error.value = r.error.userMessage
        }
    }
}

data class ThreadedComment(val comment: Comment, val depth: Int)

@HiltViewModel
class DiscussionViewModel @Inject constructor(savedState: SavedStateHandle, private val social: SocialRepository, private val auth: AuthRepository) : ViewModel() {
    val id = savedState.toRoute<DiscussionRoute>().id
    val discussion = MutableStateFlow(Remote<Discussion>())
    val comments = MutableStateFlow(Remote<List<ThreadedComment>>())
    val liked = MutableStateFlow<Set<String>>(emptySet())
    val error = MutableStateFlow<String?>(null)
    val myId: String? get() = (auth.state.value as? AuthState.SignedIn)?.user?.id
    private val _messages = Channel<String>(Channel.BUFFERED)
    val messages = _messages.receiveAsFlow()

    init { refresh() }

    fun refresh() = viewModelScope.launch {
        launch { discussion.load { social.discussion(id) } }
        launch { comments.load { when (val r = social.comments(id)) { is Outcome.Success -> Outcome.Success(thread(r.value)); is Outcome.Failure -> r } } }
        (social.myLikes() as? Outcome.Success)?.let { liked.value = it.value }
    }

    /** Depth-first threading; replies are capped at 4 levels of indentation for readability. */
    private fun thread(all: List<Comment>): List<ThreadedComment> {
        val byParent = all.groupBy { it.parentId }
        val out = mutableListOf<ThreadedComment>()
        fun walk(parent: String?, depth: Int) { byParent[parent].orEmpty().forEach { c -> out += ThreadedComment(c, depth.coerceAtMost(4)); walk(c.id, depth + 1) } }
        walk(null, 0)
        return out
    }

    fun post(body: String, parent: Comment?, spoilers: Boolean, done: () -> Unit) = viewModelScope.launch {
        when (val r = social.postComment(id, parent?.id, body, spoilers)) {
            is Outcome.Success -> { error.value = null; done(); refresh() }
            is Outcome.Failure -> error.value = r.error.userMessage
        }
    }
    fun like(type: String, targetId: String) = viewModelScope.launch {
        when (val r = social.toggleLike(type, targetId)) {
            is Outcome.Success -> { liked.update { if (r.value) it + "$type:$targetId" else it - "$type:$targetId" }; refresh() }
            is Outcome.Failure -> _messages.send(r.error.userMessage)
        }
    }
    fun delete(c: Comment) = viewModelScope.launch { social.deleteComment(c.id); refresh() }
    fun report(type: String, targetId: String, reason: String) = viewModelScope.launch {
        _messages.send(if (social.report(type, targetId, reason) is Outcome.Success) "Reported to moderators" else "Couldn't send report")
    }
}

@HiltViewModel
class WriteReviewViewModel @Inject constructor(savedState: SavedStateHandle, private val social: SocialRepository, private val library: LibraryRepository) : ViewModel() {
    val route = savedState.toRoute<WriteReviewRoute>()
    val state = MutableStateFlow(com.kaze.mobile.feature.auth.FormState())
    val available get() = social.isAvailable
    fun submit(score: Int, body: String, spoilers: Boolean, cover: String?) = viewModelScope.launch {
        state.value = com.kaze.mobile.feature.auth.FormState(busy = true)
        when (val r = social.postReview(route.animeId, route.title, cover, score, body, spoilers)) {
            is Outcome.Success -> {
                library.logEvent(ActivityTypes.REVIEW_POSTED, route.animeId, route.title, "$score/100")
                social.postActivity(ActivityTypes.REVIEW_POSTED, route.animeId, route.title, cover, "$score/100")
                state.value = com.kaze.mobile.feature.auth.FormState(done = true)
            }
            is Outcome.Failure -> state.value = com.kaze.mobile.feature.auth.FormState(error = r.error.userMessage)
        }
    }
}

@HiltViewModel
class EditProfileViewModel @Inject constructor(private val social: SocialRepository) : ViewModel() {
    val profile = MutableStateFlow(Remote<Profile>())
    val state = MutableStateFlow(com.kaze.mobile.feature.auth.FormState())
    init { viewModelScope.launch { profile.load { social.loadMyProfile() } } }
    fun save(displayName: String, username: String, bio: String, avatar: String, banner: String, theme: String?, genres: List<String>) = viewModelScope.launch {
        state.value = com.kaze.mobile.feature.auth.FormState(busy = true)
        state.value = when (val r = social.updateProfile(displayName, username, bio, avatar, banner, theme, genres)) {
            is Outcome.Success -> com.kaze.mobile.feature.auth.FormState(done = true)
            is Outcome.Failure -> com.kaze.mobile.feature.auth.FormState(error = r.error.userMessage)
        }
    }
    fun savePrivacy(isPrivate: Boolean, showActivity: Boolean, showOnline: Boolean) = viewModelScope.launch {
        state.value = when (val r = social.updatePrivacy(isPrivate, showActivity, showOnline)) {
            is Outcome.Success -> { profile.load { social.loadMyProfile() }; com.kaze.mobile.feature.auth.FormState(info = "Privacy settings saved") }
            is Outcome.Failure -> com.kaze.mobile.feature.auth.FormState(error = r.error.userMessage)
        }
    }
}

@HiltViewModel
class ConnectedAccountsViewModel @Inject constructor(
    private val anilistAuth: AniListAuthRepository,
    private val cloud: CloudLibraryRepository,
    auth: AuthRepository,
) : ViewModel() {
    val account = anilistAuth.account
    val anilistConfigured = anilistAuth.isConfigured
    val authState = auth.state
    val events = anilistAuth.events
    val preview = MutableStateFlow<Remote<AniListSyncPreview>?>(null)
    val cloudPreview = MutableStateFlow<Remote<SyncPlan>?>(null)
    val choices = MutableStateFlow<Map<Int, ConflictChoice>>(emptyMap())
    val result = MutableStateFlow<String?>(null)
    val busy = MutableStateFlow(false)

    fun connect(context: Context) = anilistAuth.startAuthorization(context)
    fun disconnect() { anilistAuth.disconnect(); preview.value = null }
    fun choose(id: Int, c: ConflictChoice) = choices.update { it + (id to c) }

    fun loadPreview() = viewModelScope.launch {
        preview.value = Remote(); choices.value = emptyMap()
        preview.value = when (val r = anilistAuth.preview()) { is Outcome.Success -> Remote(r.value, false); is Outcome.Failure -> Remote(null, false, r.error) }
    }

    fun apply(push: Boolean) = viewModelScope.launch {
        val p = preview.value?.data ?: return@launch
        busy.value = true
        result.value = when (val r = anilistAuth.apply(p, choices.value, push)) {
            is Outcome.Success -> "Imported ${r.value.pulled}, sent ${r.value.pushed} to AniList, resolved ${r.value.resolved} conflicts" + if (r.value.failed > 0) " · ${r.value.failed} failed (will retry next sync)" else ""
            is Outcome.Failure -> r.error.userMessage
        }
        busy.value = false
        preview.value = null
    }

    fun loadCloudPreview() = viewModelScope.launch {
        cloudPreview.value = Remote(); choices.value = emptyMap()
        cloudPreview.value = when (val r = cloud.preview()) { is Outcome.Success -> Remote(r.value, false); is Outcome.Failure -> Remote(null, false, r.error) }
    }

    fun applyCloud() = viewModelScope.launch {
        val p = cloudPreview.value?.data ?: return@launch
        busy.value = true
        result.value = when (val r = cloud.apply(p, choices.value)) {
            is Outcome.Success -> "Cloud library synced: ${r.value.first} downloaded, ${r.value.second} uploaded"
            is Outcome.Failure -> r.error.userMessage
        }
        busy.value = false
        cloudPreview.value = null
    }
}
