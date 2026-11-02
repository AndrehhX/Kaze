package com.kaze.mobile.data.backend

import com.kaze.mobile.core.common.KazeError
import com.kaze.mobile.core.common.KazeException
import com.kaze.mobile.core.common.Outcome
import com.kaze.mobile.core.common.outcomeOf
import com.kaze.mobile.core.text.SafeRichText
import com.kaze.mobile.domain.social.Activity
import com.kaze.mobile.domain.social.AppNotification
import com.kaze.mobile.domain.social.Block
import com.kaze.mobile.domain.social.Comment
import com.kaze.mobile.domain.social.Discussion
import com.kaze.mobile.domain.social.FriendRequest
import com.kaze.mobile.domain.social.Friendship
import com.kaze.mobile.domain.social.Like
import com.kaze.mobile.domain.social.Profile
import com.kaze.mobile.domain.social.Review
import com.kaze.mobile.domain.social.UsernameRules
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.builtins.ListSerializer
import java.net.URLEncoder
import javax.inject.Inject
import javax.inject.Singleton

private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")

/** All social data lives in Supabase behind RLS; this class never fakes a response. */
@Singleton
class SocialRepository @Inject constructor(private val sb: SupabaseClient) {

    private val me: String get() = sb.currentUserId ?: throw KazeException(KazeError.Unauthorized)
    val isAvailable: Boolean get() = sb.config.isConfigured && sb.currentUserId != null

    private val _myProfile = MutableStateFlow<Profile?>(null)
    val myProfile: Flow<Profile?> = _myProfile.asStateFlow()

    private val profileSer = ListSerializer(Profile.serializer())

    // ------------------------------------------------------------ profiles
    suspend fun loadMyProfile(): Outcome<Profile> = outcomeOf {
        sb.select("profiles", "id=eq.$me&select=*", profileSer).firstOrNull()?.also { _myProfile.value = it }
            ?: throw KazeException(KazeError.NotFound("Your profile"))
    }

    suspend fun profile(id: String): Outcome<Profile> = outcomeOf {
        sb.select("profiles", "id=eq.${enc(id)}&select=*", profileSer).firstOrNull() ?: throw KazeException(KazeError.NotFound("That profile"))
    }

    suspend fun updateProfile(displayName: String, username: String, bio: String, avatarUrl: String?, bannerUrl: String?, theme: String?, genres: List<String>): Outcome<Profile> = outcomeOf {
        if (!UsernameRules.isValid(username)) throw KazeException(KazeError.Validation("Username must be ${UsernameRules.HINT}."))
        listOf(avatarUrl, bannerUrl).forEach { if (it != null && it.isNotBlank() && !it.startsWith("https://")) throw KazeException(KazeError.Validation("Image links must start with https://")) }
        val body = mapOf(
            "display_name" to SafeRichText.sanitizeUserInput(displayName, 40),
            "username" to username,
            "bio" to SafeRichText.sanitizeUserInput(bio, 300),
            "avatar_url" to avatarUrl?.takeIf { it.isNotBlank() },
            "banner_url" to bannerUrl?.takeIf { it.isNotBlank() },
            "profile_theme" to theme,
            "favorite_genres" to genres.take(12),
        ).toJsonBody()
        sb.update("profiles", "id=eq.$me", body).let { sb.select("profiles", "id=eq.$me&select=*", profileSer).first() }.also { _myProfile.value = it }
    }

    suspend fun updatePrivacy(isPrivate: Boolean, showActivity: Boolean, showOnline: Boolean): Outcome<Unit> = outcomeOf {
        sb.update("profiles", "id=eq.$me", mapOf("is_private" to isPrivate, "show_activity" to showActivity, "show_online" to showOnline).toJsonBody())
        loadMyProfile()
        Unit
    }

    suspend fun searchUsers(query: String): Outcome<List<Profile>> = outcomeOf {
        val q = query.trim().filter { it.isLetterOrDigit() || it == '_' }.take(24)
        if (q.length < 2) return@outcomeOf emptyList()
        sb.select("profiles", "or=(username.ilike.*$q*,display_name.ilike.*$q*)&id=neq.$me&select=*&limit=25", profileSer)
    }

    // ------------------------------------------------------------ friends
    suspend fun friends(): Outcome<List<Profile>> = outcomeOf {
        val rows = sb.select(
            "friendships",
            "or=(user_a.eq.$me,user_b.eq.$me)&select=user_a,user_b,created_at,a:profiles!friendships_user_a_fkey(*),b:profiles!friendships_user_b_fkey(*)",
            ListSerializer(Friendship.serializer()),
        )
        rows.mapNotNull { it.other(me) }.sortedBy { it.name.lowercase() }
    }

    suspend fun incomingRequests(): Outcome<List<FriendRequest>> = outcomeOf {
        sb.select("friend_requests", "receiver_id=eq.$me&status=eq.pending&select=*,sender:profiles!friend_requests_sender_id_fkey(*)&order=created_at.desc", ListSerializer(FriendRequest.serializer()))
    }

    suspend fun outgoingRequests(): Outcome<List<FriendRequest>> = outcomeOf {
        sb.select("friend_requests", "sender_id=eq.$me&status=eq.pending&select=*,receiver:profiles!friend_requests_receiver_id_fkey(*)&order=created_at.desc", ListSerializer(FriendRequest.serializer()))
    }

    suspend fun sendFriendRequest(userId: String) = outcomeOf { sb.rpc("send_friend_request", mapOf("target" to userId).toJsonBody()); Unit }
    suspend fun respond(requestId: String, accept: Boolean) = outcomeOf { sb.rpc("respond_friend_request", mapOf("request_id" to requestId, "accept" to accept).toJsonBody()); Unit }
    suspend fun cancelRequest(requestId: String) = outcomeOf { sb.rpc("cancel_friend_request", mapOf("request_id" to requestId).toJsonBody()); Unit }
    suspend fun removeFriend(userId: String) = outcomeOf { sb.rpc("remove_friend", mapOf("other" to userId).toJsonBody()); Unit }
    suspend fun block(userId: String) = outcomeOf { sb.rpc("block_user", mapOf("target" to userId).toJsonBody()); Unit }
    suspend fun unblock(userId: String) = outcomeOf { sb.rpc("unblock_user", mapOf("target" to userId).toJsonBody()); Unit }
    suspend fun mutualFriends(userId: String) = outcomeOf { sb.rpc("mutual_friends", mapOf("other" to userId).toJsonBody(), profileSer) }

    suspend fun blocked(): Outcome<List<Block>> = outcomeOf {
        sb.select("blocks", "blocker_id=eq.$me&select=blocked_id,blocked:profiles!blocks_blocked_id_fkey(*)", ListSerializer(Block.serializer()))
    }

    suspend fun relationship(userId: String): Outcome<Relationship> = outcomeOf {
        val friends = sb.rpc("are_friends", mapOf("a" to me, "b" to userId).toJsonBody()).trim() == "true"
        val pending = sb.select("friend_requests", "status=eq.pending&or=(and(sender_id.eq.$me,receiver_id.eq.${enc(userId)}),and(sender_id.eq.${enc(userId)},receiver_id.eq.$me))&select=*", ListSerializer(FriendRequest.serializer())).firstOrNull()
        val blocked = sb.select("blocks", "blocker_id=eq.$me&blocked_id=eq.${enc(userId)}&select=blocked_id", ListSerializer(Block.serializer())).isNotEmpty()
        Relationship(friends, pending?.takeIf { it.senderId == me }, pending?.takeIf { it.receiverId == me }, blocked)
    }

    data class Relationship(val isFriend: Boolean, val outgoing: FriendRequest?, val incoming: FriendRequest?, val blockedByMe: Boolean)

    // ------------------------------------------------------------ activity
    suspend fun friendsActivity(limit: Int = 40): Outcome<List<Activity>> = outcomeOf {
        // RLS returns only rows from friends who share activity (plus our own); we exclude our own here.
        sb.select("activities", "user_id=neq.$me&select=*,user:profiles!activities_user_id_fkey(*)&order=created_at.desc&limit=$limit", ListSerializer(Activity.serializer()))
    }

    suspend fun userActivity(userId: String) = outcomeOf {
        sb.select("activities", "user_id=eq.${enc(userId)}&select=*&order=created_at.desc&limit=30", ListSerializer(Activity.serializer()))
    }

    suspend fun postActivity(type: String, animeId: Int?, title: String?, cover: String?, detail: String?) = outcomeOf {
        sb.insert("activities", mapOf("user_id" to me, "type" to type, "anime_id" to animeId, "anime_title" to title, "anime_cover" to cover, "detail" to detail?.take(200)).toJsonBody(), returning = false)
        Unit
    }

    // ------------------------------------------------------------ reviews
    suspend fun reviews(animeId: Int? = null, page: Int = 0): Outcome<List<Review>> = outcomeOf {
        val filter = animeId?.let { "anime_id=eq.$it&" } ?: ""
        sb.select("reviews", "${filter}select=*,author:profiles!reviews_user_id_fkey(*)&order=created_at.desc&limit=20&offset=${page * 20}", ListSerializer(Review.serializer()))
    }

    suspend fun postReview(animeId: Int, title: String, cover: String?, score: Int, body: String, spoilers: Boolean): Outcome<Unit> = outcomeOf {
        val clean = SafeRichText.sanitizeUserInput(body, 8000)
        if (clean.length < 20) throw KazeException(KazeError.Validation("Reviews need at least 20 characters."))
        if (score !in 1..100) throw KazeException(KazeError.Validation("Pick a score between 1 and 100."))
        sb.insert("reviews?on_conflict=user_id,anime_id", mapOf(
            "user_id" to me, "anime_id" to animeId, "anime_title" to title, "anime_cover" to cover,
            "score" to score, "body" to clean, "has_spoilers" to spoilers,
        ).toJsonBody(), returning = false, upsert = true)
        Unit
    }

    suspend fun deleteReview(id: String) = outcomeOf { sb.delete("reviews", "id=eq.${enc(id)}&user_id=eq.$me") }

    // ------------------------------------------------------------ discussions & comments
    suspend fun discussions(page: Int = 0): Outcome<List<Discussion>> = outcomeOf {
        sb.select("discussions", "select=*,author:profiles!discussions_user_id_fkey(*)&order=last_activity_at.desc&limit=25&offset=${page * 25}", ListSerializer(Discussion.serializer()))
    }

    suspend fun discussion(id: String): Outcome<Discussion> = outcomeOf {
        sb.select("discussions", "id=eq.${enc(id)}&select=*,author:profiles!discussions_user_id_fkey(*)", ListSerializer(Discussion.serializer())).firstOrNull()
            ?: throw KazeException(KazeError.NotFound("That discussion"))
    }

    suspend fun createDiscussion(title: String, body: String, spoilers: Boolean, animeId: Int?, animeTitle: String?): Outcome<String> = outcomeOf {
        val t = SafeRichText.sanitizeUserInput(title, 140)
        val b = SafeRichText.sanitizeUserInput(body, 8000)
        if (t.length < 4) throw KazeException(KazeError.Validation("Give your discussion a title (4+ characters)."))
        if (b.isEmpty()) throw KazeException(KazeError.Validation("Write something to start the discussion."))
        val res = sb.insert("discussions", mapOf("user_id" to me, "title" to t, "body" to b, "has_spoilers" to spoilers, "anime_id" to animeId, "anime_title" to animeTitle).toJsonBody())
        kotlinx.serialization.json.Json { ignoreUnknownKeys = true }.decodeFromString(ListSerializer(Discussion.serializer()), res).first().id
    }

    suspend fun comments(discussionId: String): Outcome<List<Comment>> = outcomeOf {
        sb.select("comments", "discussion_id=eq.${enc(discussionId)}&select=*,author:profiles!comments_user_id_fkey(*)&order=created_at.asc&limit=500", ListSerializer(Comment.serializer()))
    }

    suspend fun postComment(discussionId: String, parentId: String?, body: String, spoilers: Boolean): Outcome<Unit> = outcomeOf {
        val b = SafeRichText.sanitizeUserInput(body, 4000)
        if (b.isEmpty()) throw KazeException(KazeError.Validation("Comment can't be empty."))
        sb.insert("comments", mapOf("discussion_id" to discussionId, "parent_id" to parentId, "user_id" to me, "body" to b, "has_spoilers" to spoilers).toJsonBody(), returning = false)
        Unit
    }

    suspend fun deleteComment(id: String) = outcomeOf {
        sb.update("comments", "id=eq.${enc(id)}&user_id=eq.$me", mapOf("is_deleted" to true, "body" to "[deleted]").toJsonBody()); Unit
    }

    suspend fun toggleLike(type: String, id: String): Outcome<Boolean> = outcomeOf {
        sb.rpc("toggle_like", mapOf("t_type" to type, "t_id" to id).toJsonBody()).trim() == "true"
    }

    suspend fun myLikes(): Outcome<Set<String>> = outcomeOf {
        sb.select("likes", "user_id=eq.$me&select=target_type,target_id&limit=1000", ListSerializer(Like.serializer())).map { "${it.targetType}:${it.targetId}" }.toSet()
    }

    suspend fun report(type: String, id: String, reason: String) = outcomeOf {
        val r = SafeRichText.sanitizeUserInput(reason, 500)
        if (r.length < 3) throw KazeException(KazeError.Validation("Tell moderators briefly what's wrong."))
        sb.insert("reports", mapOf("reporter_id" to me, "target_type" to type, "target_id" to id, "reason" to r).toJsonBody(), returning = false)
        Unit
    }

    // ------------------------------------------------------------ notifications
    suspend fun notifications(): Outcome<List<AppNotification>> = outcomeOf {
        sb.select("notifications", "user_id=eq.$me&select=*,actor:profiles!notifications_actor_id_fkey(*)&order=created_at.desc&limit=100", ListSerializer(AppNotification.serializer()))
    }

    suspend fun unreadSince(isoTime: String): Outcome<List<AppNotification>> = outcomeOf {
        sb.select("notifications", "user_id=eq.$me&read_at=is.null&created_at=gt.${enc(isoTime)}&select=*&order=created_at.desc&limit=20", ListSerializer(AppNotification.serializer()))
    }

    suspend fun markRead(id: String?) = outcomeOf {
        val filter = if (id == null) "user_id=eq.$me&read_at=is.null" else "id=eq.${enc(id)}"
        sb.update("notifications", filter, mapOf("read_at" to java.time.Instant.now().toString()).toJsonBody()); Unit
    }

    // ------------------------------------------------------------ account
    suspend fun deleteAccount(): Outcome<Unit> = outcomeOf {
        sb.rpc("delete_my_account")
        sb.clearSession()
        _myProfile.value = null
    }

    fun clearCache() { _myProfile.value = null }
}
