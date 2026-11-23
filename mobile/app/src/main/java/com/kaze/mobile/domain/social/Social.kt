package com.kaze.mobile.domain.social

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive

/*
 * Todos estos modelos leen las MISMAS tablas que KAZE Web (Supabase compartido).
 * Los nombres de columna siguen el esquema de la web (crunchy/supabase/migrations).
 */

/** Fotografía mínima de un anime (`media_snapshot`); claves iguales a las que escribe la web. */
@Serializable
data class MediaSnap(
    val title: String? = null,
    val cover: String? = null,
    val banner: String? = null,
    val color: String? = null,
    val format: String? = null,
    val episodes: Int? = null,
    val year: Int? = null,
    val genres: List<String> = emptyList(),
    val kind: String? = null,
    val episode: JsonPrimitive? = null,
) {
    val episodeNumber: Int? get() = episode?.contentOrNull?.toIntOrNull()
}

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
    val visibility: String = "public",
    @SerialName("show_activity") val showActivity: Boolean = true,
    @SerialName("show_online_status") val showOnline: Boolean = false,
    @SerialName("created_at") val createdAt: String? = null,
) {
    val name: String get() = displayName.ifBlank { username }
    val isPrivate: Boolean get() = visibility != "public"
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

/** Fila de `activity_events`: la genera la base de datos al cambiar la biblioteca o publicar reseñas. */
@Serializable
data class Activity(
    val id: String,
    @SerialName("user_id") val userId: String,
    @SerialName("kind") val type: String,
    @SerialName("media_id") val animeId: Int? = null,
    @SerialName("media_snapshot") val media: MediaSnap? = null,
    val payload: JsonObject? = null,
    @SerialName("created_at") val createdAt: String,
    val user: Profile? = null,
) {
    val animeTitle: String? get() = media?.title
    val animeCover: String? get() = media?.cover
    val detail: String? get() = payload?.get("score")?.jsonPrimitive?.intOrNull?.let { "$it/100" }
}

/** Reseñas de la web: nota 1–10 (`rating`); la app la muestra sobre 100. */
@Serializable
data class Review(
    val id: String,
    @SerialName("user_id") val userId: String,
    @SerialName("media_id") val animeId: Int,
    @SerialName("media_snapshot") val media: MediaSnap? = null,
    val rating: Int,
    val title: String = "",
    val body: String,
    @SerialName("has_spoilers") val hasSpoilers: Boolean = false,
    @SerialName("like_count") val likeCount: Int = 0,
    @SerialName("comment_count") val commentCount: Int = 0,
    @SerialName("created_at") val createdAt: String,
    val author: Profile? = null,
) {
    val animeTitle: String get() = media?.title ?: "Anime #$animeId"
    val animeCover: String? get() = media?.cover
    val score: Int get() = rating * 10
}

@Serializable
data class Discussion(
    val id: String,
    @SerialName("user_id") val userId: String,
    @SerialName("media_id") val animeId: Int? = null,
    @SerialName("media_snapshot") val media: MediaSnap? = null,
    val title: String,
    val body: String,
    @SerialName("has_spoilers") val hasSpoilers: Boolean = false,
    @SerialName("comment_count") val commentCount: Int = 0,
    val status: String = "published",
    @SerialName("created_at") val createdAt: String,
    @SerialName("last_activity_at") val lastActivityAt: String? = null,
    val author: Profile? = null,
) {
    val animeTitle: String? get() = media?.title
    val likeCount: Int get() = 0
    val isEpisodeThread: Boolean get() = media?.kind == "episode"
}

/** Comentarios de la web: apuntan a una reseña o a un debate con `target_type` + `target_id`. */
@Serializable
data class Comment(
    val id: String,
    @SerialName("target_type") val targetType: String = "discussion",
    @SerialName("target_id") val targetId: String = "",
    @SerialName("parent_id") val parentId: String? = null,
    @SerialName("user_id") val userId: String,
    val body: String,
    @SerialName("has_spoilers") val hasSpoilers: Boolean = false,
    val status: String = "published",
    @SerialName("created_at") val createdAt: String,
    val author: Profile? = null,
) {
    val discussionId: String? get() = targetId.takeIf { targetType == "discussion" }
    val reviewId: String? get() = targetId.takeIf { targetType == "review" }
    val isDeleted: Boolean get() = status != "published"
    val likeCount: Int get() = 0
}

/** "Me gusta" de reseñas (`review_reactions`): la web solo tiene likes en reseñas. */
@Serializable
data class Like(@SerialName("review_id") val reviewId: String) {
    val targetType: String get() = "review"
    val targetId: String get() = reviewId
}

/** Notificación con el formato de la web: `kind` + `payload`. Textos iguales a los de la web. */
@Serializable
data class AppNotification(
    val id: String,
    @SerialName("kind") val type: String,
    val payload: JsonObject = JsonObject(emptyMap()),
    @SerialName("read_at") val readAt: String? = null,
    @SerialName("created_at") val createdAt: String,
    val actor: Profile? = null,
) {
    private fun p(key: String): String? = payload[key]?.jsonPrimitive?.contentOrNull
    val entityId: String? get() = p("room_id") ?: p("target_id") ?: p("review_id")
    val title: String get() {
        val who = actor?.name ?: "Alguien"
        return when (type) {
            "friend_request" -> "$who te envió una solicitud de amistad"
            "friend_accepted" -> "$who aceptó tu solicitud de amistad"
            "review_like" -> "A $who le gustó tu reseña"
            "comment" -> "$who comentó en tu ${if (p("target_type") == "discussion") "debate" else "reseña"}"
            "reply" -> "$who respondió a tu comentario"
            "watch_party_invite" -> "$who te invitó a “${p("title") ?: "una sala de cine"}”"
            "achievement" -> "Logro desbloqueado: ${p("name").orEmpty()}"
            else -> p("message") ?: "Actualización"
        }
    }
    val body: String get() = ""
}

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
