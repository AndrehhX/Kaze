package com.kaze.mobile.domain.social

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Profile(
    val id: String,
    val username: String,
    @SerialName("display_name") val displayName: String = "",
    val bio: String = "",
    @SerialName("avatar_url") val avatarUrl: String? = null,
    @SerialName("banner_url") val bannerUrl: String? = null,
    @SerialName("profile_theme") val profileTheme: String? = null,
    @SerialName("favorite_genres") val favoriteGenres: List<String> = emptyList(),
    @SerialName("is_private") val isPrivate: Boolean = false,
    @SerialName("show_activity") val showActivity: Boolean = true,
    @SerialName("show_online") val showOnline: Boolean = false,
    @SerialName("created_at") val createdAt: String? = null,
) {
    val name: String get() = displayName.ifBlank { username }
}

@Serializable
data class FriendRequest(
    val id: String,
    @SerialName("sender_id") val senderId: String,
    @SerialName("receiver_id") val receiverId: String,
    val status: String,
    @SerialName("created_at") val createdAt: String,
    val sender: Profile? = null,
    val receiver: Profile? = null,
)

@Serializable
data class Friendship(
    @SerialName("user_a") val userA: String,
    @SerialName("user_b") val userB: String,
    @SerialName("created_at") val createdAt: String? = null,
    val a: Profile? = null,
    val b: Profile? = null,
) {
    fun other(me: String): Profile? = if (userA == me) b else a
}

@Serializable
data class Block(@SerialName("blocked_id") val blockedId: String, val blocked: Profile? = null)

@Serializable
data class Activity(
    val id: String,
    @SerialName("user_id") val userId: String,
    val type: String,
    @SerialName("anime_id") val animeId: Int? = null,
    @SerialName("anime_title") val animeTitle: String? = null,
    @SerialName("anime_cover") val animeCover: String? = null,
    val detail: String? = null,
    @SerialName("created_at") val createdAt: String,
    val user: Profile? = null,
)

@Serializable
data class Review(
    val id: String,
    @SerialName("user_id") val userId: String,
    @SerialName("anime_id") val animeId: Int,
    @SerialName("anime_title") val animeTitle: String,
    @SerialName("anime_cover") val animeCover: String? = null,
    val score: Int,
    val body: String,
    @SerialName("has_spoilers") val hasSpoilers: Boolean = false,
    @SerialName("like_count") val likeCount: Int = 0,
    @SerialName("created_at") val createdAt: String,
    val author: Profile? = null,
)

@Serializable
data class Discussion(
    val id: String,
    @SerialName("user_id") val userId: String,
    @SerialName("anime_id") val animeId: Int? = null,
    @SerialName("anime_title") val animeTitle: String? = null,
    val title: String,
    val body: String,
    @SerialName("has_spoilers") val hasSpoilers: Boolean = false,
    @SerialName("comment_count") val commentCount: Int = 0,
    @SerialName("like_count") val likeCount: Int = 0,
    @SerialName("created_at") val createdAt: String,
    @SerialName("last_activity_at") val lastActivityAt: String? = null,
    val author: Profile? = null,
)

@Serializable
data class Comment(
    val id: String,
    @SerialName("discussion_id") val discussionId: String? = null,
    @SerialName("review_id") val reviewId: String? = null,
    @SerialName("parent_id") val parentId: String? = null,
    @SerialName("user_id") val userId: String,
    val body: String,
    @SerialName("has_spoilers") val hasSpoilers: Boolean = false,
    @SerialName("like_count") val likeCount: Int = 0,
    @SerialName("is_deleted") val isDeleted: Boolean = false,
    @SerialName("created_at") val createdAt: String,
    val author: Profile? = null,
)

@Serializable
data class Like(@SerialName("target_type") val targetType: String, @SerialName("target_id") val targetId: String)

@Serializable
data class AppNotification(
    val id: String,
    val type: String,
    @SerialName("entity_id") val entityId: String? = null,
    val title: String,
    val body: String = "",
    @SerialName("read_at") val readAt: String? = null,
    @SerialName("created_at") val createdAt: String,
    val actor: Profile? = null,
)

@Serializable
data class Party(
    val id: String,
    val code: String,
    @SerialName("host_id") val hostId: String,
    @SerialName("anime_id") val animeId: Int,
    @SerialName("anime_title") val animeTitle: String,
    @SerialName("anime_cover") val animeCover: String? = null,
    val episode: Int = 1,
    @SerialName("is_playing") val isPlaying: Boolean = false,
    @SerialName("position_ms") val positionMs: Long = 0,
    @SerialName("playback_rate") val playbackRate: Float = 1f,
    @SerialName("state_updated_at") val stateUpdatedAt: String,
    @SerialName("expires_at") val expiresAt: String? = null,
    @SerialName("ended_at") val endedAt: String? = null,
)

@Serializable
data class PartyMessage(
    val id: String,
    @SerialName("party_id") val partyId: String,
    @SerialName("user_id") val userId: String,
    val kind: String = "chat",
    val body: String,
    @SerialName("created_at") val createdAt: String,
)

@Serializable
data class PartyMember(@SerialName("user_id") val userId: String, @SerialName("joined_at") val joinedAt: String, val profile: Profile? = null)

object UsernameRules {
    private val pattern = Regex("^[A-Za-z0-9_]{3,24}$")
    fun isValid(u: String) = pattern.matches(u)
    const val HINT = "3–24 letters, numbers or underscores"
}

object PasswordRules {
    fun problems(p: String): List<String> = buildList {
        if (p.length < 10) add("at least 10 characters")
        if (p.none { it.isDigit() }) add("a number")
        if (p.none { it.isLetter() }) add("a letter")
    }
}

object EmailRules {
    private val pattern = Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]{2,}$")
    fun isValid(e: String) = pattern.matches(e.trim())
}
