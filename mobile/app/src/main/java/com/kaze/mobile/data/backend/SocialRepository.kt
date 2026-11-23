package com.kaze.mobile.data.backend

import com.kaze.mobile.core.common.KazeError
import com.kaze.mobile.core.common.KazeException
import com.kaze.mobile.core.common.Outcome
import com.kaze.mobile.core.common.outcomeOf
import com.kaze.mobile.core.designsystem.theme.KazeThemeId
import com.kaze.mobile.core.text.SafeRichText
import com.kaze.mobile.domain.social.Activity
import com.kaze.mobile.domain.social.AppNotification
import com.kaze.mobile.domain.social.Block
import com.kaze.mobile.domain.social.Comment
import com.kaze.mobile.domain.social.Discussion
import com.kaze.mobile.domain.social.FriendRequest
import com.kaze.mobile.domain.social.Like
import com.kaze.mobile.domain.social.Profile
import com.kaze.mobile.domain.social.Review
import com.kaze.mobile.domain.social.UsernameRules
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import java.net.URLEncoder
import javax.inject.Inject
import javax.inject.Singleton

private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")

@Serializable
private data class IdRow(val id: String)

/**
 * Datos sociales en Supabase, en las MISMAS tablas que usa KAZE Web (esquema en
 * crunchy/supabase/migrations). Lo que se publica aquí aparece en la web y al revés.
 */
@Singleton
class SocialRepository @Inject constructor(private val sb: SupabaseClient) {

    private val me: String get() = sb.currentUserId ?: throw KazeException(KazeError.Unauthorized)
    val isAvailable: Boolean get() = sb.config.isConfigured && sb.currentUserId != null

    private val _myProfile = MutableStateFlow<Profile?>(null)
    val myProfile: Flow<Profile?> = _myProfile.asStateFlow()

    private val profileSer = ListSerializer(Profile.serializer())
    private val lenient = Json { ignoreUnknownKeys = true }

    // ------------------------------------------------------------ profiles
    suspend fun loadMyProfile(): Outcome<Profile> = outcomeOf {
        sb.select("profiles", "id=eq.$me&select=*", profileSer).firstOrNull()?.also { _myProfile.value = it }
            ?: throw KazeException(KazeError.NotFound("Tu perfil"))
    }

    suspend fun profile(id: String): Outcome<Profile> = outcomeOf {
        sb.select("profiles", "id=eq.${enc(id)}&select=*", profileSer).firstOrNull() ?: throw KazeException(KazeError.NotFound("Ese perfil"))
    }

    suspend fun updateProfile(displayName: String, username: String, bio: String, avatarUrl: String?, bannerUrl: String?, theme: String?, genres: List<String>): Outcome<Profile> = outcomeOf {
        if (!UsernameRules.isValid(username)) throw KazeException(KazeError.Validation("El usuario debe tener ${UsernameRules.HINT}."))
        listOf(avatarUrl, bannerUrl).forEach { if (it != null && it.isNotBlank() && !it.startsWith("https://")) throw KazeException(KazeError.Validation("Los enlaces de imagen deben empezar por https://")) }
        val body = mapOf(
            "display_name" to SafeRichText.sanitizeUserInput(displayName, 48),
            "username" to username,
            "bio" to SafeRichText.sanitizeUserInput(bio, 600),
            "avatar_url" to avatarUrl?.takeIf { it.isNotBlank() },
            "banner_url" to bannerUrl?.takeIf { it.isNotBlank() },
            "profile_theme" to KazeThemeId.webKeyOf(theme),
            "favorite_genres" to genres.take(10),
        ).toJsonBody()
        sb.update("profiles", "id=eq.$me", body).let { sb.select("profiles", "id=eq.$me&select=*", profileSer).first() }.also { _myProfile.value = it }
    }

    suspend fun updatePrivacy(isPrivate: Boolean, showActivity: Boolean, showOnline: Boolean): Outcome<Unit> = outcomeOf {
        sb.update("profiles", "id=eq.$me", mapOf("visibility" to if (isPrivate) "friends" else "public", "show_activity" to showActivity, "show_online_status" to showOnline).toJsonBody())
        loadMyProfile()
        Unit
    }

    suspend fun searchUsers(query: String): Outcome<List<Profile>> = outcomeOf {
        val q = query.trim().filter { it.isLetterOrDigit() || it == '_' }.take(24)
        if (q.length < 2) return@outcomeOf emptyList()
        sb.select("profiles", "or=(username.ilike.*$q*,display_name.ilike.*$q*)&id=neq.$me&select=*&limit=25", profileSer)
    }

    // ------------------------------------------------------------ friends
    // En producción la amistad vive en UNA tabla: `friendships(id, requester_id, addressee_id,
    // status = pending|accepted)`. Es lo mismo que usa la web (src/lib/social.ts y friends.tsx).
    @Serializable
    private data class FriendRow(
        val id: String,
        @kotlinx.serialization.SerialName("requester_id") val requesterId: String,
        @kotlinx.serialization.SerialName("addressee_id") val addresseeId: String,
        val status: String,
        @kotlinx.serialization.SerialName("created_at") val createdAt: String = "",
    )

    private val friendRowSer = ListSerializer(FriendRow.serializer())
    private val friendCols = "id,requester_id,addressee_id,status,created_at"

    private suspend fun profilesByIds(ids: Collection<String>): Map<String, Profile> {
        if (ids.isEmpty()) return emptyMap()
        return sb.select("profiles", "id=in.(${ids.joinToString(",") { enc(it) }})&select=*", profileSer).associateBy { it.id }
    }

    private fun pairFilter(other: String) =
        "or=(and(requester_id.eq.$me,addressee_id.eq.${enc(other)}),and(requester_id.eq.${enc(other)},addressee_id.eq.$me))"

    private suspend fun friendIds(): List<String> =
        sb.select("friendships", "or=(requester_id.eq.$me,addressee_id.eq.$me)&status=eq.accepted&select=$friendCols", friendRowSer)
            .map { if (it.requesterId == me) it.addresseeId else it.requesterId }.distinct()

    suspend fun friends(): Outcome<List<Profile>> = outcomeOf {
        profilesByIds(friendIds()).values.sortedBy { it.name.lowercase() }
    }

    private suspend fun pending(incoming: Boolean): List<FriendRequest> {
        val col = if (incoming) "addressee_id" else "requester_id"
        val rows = sb.select("friendships", "$col=eq.$me&status=eq.pending&select=$friendCols&order=created_at.desc", friendRowSer)
        val people = profilesByIds(rows.flatMap { listOf(it.requesterId, it.addresseeId) }.toSet())
        return rows.map { FriendRequest(it.id, it.requesterId, it.addresseeId, it.status, it.createdAt, people[it.requesterId], people[it.addresseeId]) }
    }

    suspend fun incomingRequests(): Outcome<List<FriendRequest>> = outcomeOf { pending(incoming = true) }
    suspend fun outgoingRequests(): Outcome<List<FriendRequest>> = outcomeOf { pending(incoming = false) }

    suspend fun sendFriendRequest(userId: String) = outcomeOf {
        val existing = sb.select("friendships", "${pairFilter(userId)}&select=$friendCols", friendRowSer).firstOrNull()
        when {
            existing == null ->
                sb.insert("friendships", mapOf("requester_id" to me, "addressee_id" to userId, "status" to "pending").toJsonBody(), returning = false)
            // Si la otra persona ya me había enviado una, enviar la mía equivale a aceptarla.
            existing.status == "pending" && existing.addresseeId == me ->
                sb.update("friendships", "id=eq.${enc(existing.id)}", mapOf("status" to "accepted", "updated_at" to java.time.Instant.now().toString()).toJsonBody())
            else -> Unit
        }
        Unit
    }

    suspend fun respond(requestId: String, accept: Boolean) = outcomeOf {
        if (accept) sb.update("friendships", "id=eq.${enc(requestId)}&addressee_id=eq.$me", mapOf("status" to "accepted", "updated_at" to java.time.Instant.now().toString()).toJsonBody())
        else sb.delete("friendships", "id=eq.${enc(requestId)}&addressee_id=eq.$me")
        Unit
    }

    suspend fun cancelRequest(requestId: String) = outcomeOf { sb.delete("friendships", "id=eq.${enc(requestId)}&requester_id=eq.$me") }
    suspend fun removeFriend(userId: String) = outcomeOf { sb.delete("friendships", pairFilter(userId)) }

    suspend fun block(userId: String) = outcomeOf {
        runCatching { sb.insert("user_blocks", mapOf("blocker_id" to me, "blocked_id" to userId).toJsonBody(), returning = false) }
        sb.delete("friendships", pairFilter(userId))
    }

    suspend fun unblock(userId: String) = outcomeOf { sb.delete("user_blocks", "blocker_id=eq.$me&blocked_id=eq.${enc(userId)}") }

    /** La web no expone los amigos de otros usuarios (RLS), así que no hay amigos en común que calcular. */
    @Suppress("UNUSED_PARAMETER")
    suspend fun mutualFriends(userId: String): Outcome<List<Profile>> = Outcome.Success(emptyList())

    suspend fun blocked(): Outcome<List<Block>> = outcomeOf {
        val ids = sb.select("user_blocks", "blocker_id=eq.$me&select=blocked_id", ListSerializer(Block.serializer())).map { it.blockedId }
        val people = profilesByIds(ids)
        ids.map { Block(it, people[it]) }
    }

    suspend fun relationship(userId: String): Outcome<Relationship> = outcomeOf {
        val row = sb.select("friendships", "${pairFilter(userId)}&select=$friendCols", friendRowSer).firstOrNull()
        val blocked = sb.select("user_blocks", "blocker_id=eq.$me&blocked_id=eq.${enc(userId)}&select=blocked_id", ListSerializer(Block.serializer())).isNotEmpty()
        val req = row?.takeIf { it.status == "pending" }?.let { FriendRequest(it.id, it.requesterId, it.addresseeId, it.status, it.createdAt) }
        Relationship(row?.status == "accepted", req?.takeIf { it.senderId == me }, req?.takeIf { it.receiverId == me }, blocked)
    }

    data class Relationship(val isFriend: Boolean, val outgoing: FriendRequest?, val incoming: FriendRequest?, val blockedByMe: Boolean)

    // ------------------------------------------------------------ activity
    // `activity_events` lo rellena la base de datos (triggers) al sincronizar la biblioteca y al
    // publicar reseñas, igual que en la web; la app solo lo lee.
    private val activitySelect = "id,user_id,kind,media_id,media_snapshot,payload,created_at"

    /** Solo la actividad de tus amigos (antes salía la de cualquier perfil público). */
    suspend fun friendsActivity(limit: Int = 40): Outcome<List<Activity>> = outcomeOf {
        val ids = friendIds()
        if (ids.isEmpty()) return@outcomeOf emptyList()
        sb.select("activity_events", "user_id=in.(${ids.joinToString(",") { enc(it) }})&select=$activitySelect,user:profiles!activity_events_user_id_fkey(*)&order=created_at.desc&limit=$limit", ListSerializer(Activity.serializer()))
    }

    suspend fun userActivity(userId: String) = outcomeOf {
        sb.select("activity_events", "user_id=eq.${enc(userId)}&select=$activitySelect&order=created_at.desc&limit=30", ListSerializer(Activity.serializer()))
    }

    @Suppress("UNUSED_PARAMETER")
    suspend fun postActivity(type: String, animeId: Int?, title: String?, cover: String?, detail: String?): Outcome<Unit> = Outcome.Success(Unit)

    // ------------------------------------------------------------ reviews
    private val reviewSelect = "id,user_id,media_id,media_snapshot,rating,title,body,has_spoilers,like_count,comment_count,created_at,author:profiles!reviews_user_id_fkey(*)"

    suspend fun reviews(animeId: Int? = null, page: Int = 0): Outcome<List<Review>> = outcomeOf {
        val filter = animeId?.let { "media_id=eq.$it&" } ?: ""
        sb.select("reviews", "${filter}status=eq.published&select=$reviewSelect&order=created_at.desc&limit=20&offset=${page * 20}", ListSerializer(Review.serializer()))
    }

    /** [score] llega en escala 1–100 desde la app; la web guarda la nota en 1–10. */
    suspend fun postReview(animeId: Int, title: String, cover: String?, score: Int, body: String, spoilers: Boolean): Outcome<Unit> = outcomeOf {
        val clean = SafeRichText.sanitizeUserInput(body, 10000)
        if (clean.length < 40) throw KazeException(KazeError.Validation("La reseña necesita al menos 40 caracteres."))
        if (score !in 1..100) throw KazeException(KazeError.Validation("Elige una nota entre 1 y 100."))
        val rating = ((score + 5) / 10).coerceIn(1, 10)
        val reviewTitle = "Mi reseña de $title".take(120)
        sb.insert("reviews?on_conflict=user_id,media_id", mapOf(
            "user_id" to me, "media_id" to animeId,
            "media_snapshot" to mapOf("title" to title, "cover" to cover),
            "rating" to rating, "title" to reviewTitle, "body" to clean, "has_spoilers" to spoilers,
        ).toJsonBody(), returning = false, upsert = true)
        Unit
    }

    suspend fun deleteReview(id: String) = outcomeOf { sb.delete("reviews", "id=eq.${enc(id)}&user_id=eq.$me") }

    // ------------------------------------------------------------ discussions & comments
    private val discussionSelect = "id,user_id,media_id,media_snapshot,title,body,has_spoilers,status,comment_count,last_activity_at,created_at,author:profiles!discussions_user_id_fkey(*)"
    private val commentSelect = "id,target_type,target_id,parent_id,user_id,body,has_spoilers,status,created_at,author:profiles!comments_user_id_fkey(*)"

    /** Debates de la comunidad, sin los hilos automáticos de cada episodio (igual que la web). */
    suspend fun discussions(page: Int = 0): Outcome<List<Discussion>> = outcomeOf {
        sb.select("discussions", "status=eq.published&media_snapshot->>kind=is.null&select=$discussionSelect&order=last_activity_at.desc&limit=25&offset=${page * 25}", ListSerializer(Discussion.serializer()))
    }

    suspend fun discussion(id: String): Outcome<Discussion> = outcomeOf {
        sb.select("discussions", "id=eq.${enc(id)}&select=$discussionSelect", ListSerializer(Discussion.serializer())).firstOrNull()
            ?: throw KazeException(KazeError.NotFound("Ese debate"))
    }

    suspend fun createDiscussion(title: String, body: String, spoilers: Boolean, animeId: Int?, animeTitle: String?): Outcome<String> = outcomeOf {
        val t = SafeRichText.sanitizeUserInput(title, 140)
        val b = SafeRichText.sanitizeUserInput(body, 8000)
        if (t.length < 4) throw KazeException(KazeError.Validation("Ponle un título al debate (4+ caracteres)."))
        if (b.isEmpty()) throw KazeException(KazeError.Validation("Escribe algo para empezar el debate."))
        val res = sb.insert("discussions", mapOf(
            "user_id" to me, "title" to t, "body" to b, "has_spoilers" to spoilers,
            "media_id" to animeId, "media_snapshot" to animeTitle?.let { mapOf("title" to it) },
        ).toJsonBody())
        lenient.decodeFromString(ListSerializer(IdRow.serializer()), res).first().id
    }

    suspend fun comments(discussionId: String): Outcome<List<Comment>> = outcomeOf {
        sb.select("comments", "target_type=eq.discussion&target_id=eq.${enc(discussionId)}&select=$commentSelect&order=created_at.asc&limit=500", ListSerializer(Comment.serializer()))
    }

    suspend fun postComment(discussionId: String, parentId: String?, body: String, spoilers: Boolean): Outcome<Unit> = outcomeOf {
        val b = SafeRichText.sanitizeUserInput(body, 4000)
        if (b.isEmpty()) throw KazeException(KazeError.Validation("El comentario no puede estar vacío."))
        sb.insert("comments", mapOf("target_type" to "discussion", "target_id" to discussionId, "parent_id" to parentId, "user_id" to me, "body" to b, "has_spoilers" to spoilers).toJsonBody(), returning = false)
        Unit
    }

    suspend fun deleteComment(id: String) = outcomeOf {
        sb.update("comments", "id=eq.${enc(id)}&user_id=eq.$me", mapOf("status" to "removed").toJsonBody()); Unit
    }

    // ------------------------------------------------------------ episode threads (los mismos que la web)
    /**
     * Cada episodio tiene un hilo en `discussions` con `media_snapshot = {kind:"episode", episode:"N"}`:
     * es el mismo hilo que la web muestra debajo del reproductor.
     */
    private suspend fun episodeThreadId(animeId: Int, episode: Int): String? =
        sb.select("discussions", "media_id=eq.$animeId&media_snapshot->>kind=eq.episode&media_snapshot->>episode=eq.$episode&select=id&order=created_at.asc&limit=1", ListSerializer(IdRow.serializer()))
            .firstOrNull()?.id

    suspend fun episodeComments(animeId: Int, episode: Int): Outcome<List<Comment>> = outcomeOf {
        val thread = episodeThreadId(animeId, episode) ?: return@outcomeOf emptyList()
        sb.select("comments", "target_type=eq.discussion&target_id=eq.$thread&status=eq.published&select=$commentSelect&order=created_at.desc&limit=200", ListSerializer(Comment.serializer()))
    }

    suspend fun postEpisodeComment(animeId: Int, episode: Int, animeTitle: String, cover: String?, body: String, spoilers: Boolean, parentId: String? = null): Outcome<Unit> = outcomeOf {
        val b = SafeRichText.sanitizeUserInput(body, 4000)
        if (b.isEmpty()) throw KazeException(KazeError.Validation("El comentario no puede estar vacío."))
        val thread = episodeThreadId(animeId, episode) ?: run {
            val title = "Episodio $episode · $animeTitle".take(140)
            val res = sb.insert("discussions", mapOf(
                "user_id" to me, "media_id" to animeId,
                "media_snapshot" to mapOf("kind" to "episode", "episode" to episode.toString(), "title" to animeTitle, "cover" to cover),
                "title" to title,
                "body" to "Comentarios del episodio $episode de $animeTitle.",
                "has_spoilers" to false,
            ).toJsonBody())
            lenient.decodeFromString(ListSerializer(IdRow.serializer()), res).first().id
        }
        sb.insert("comments", mapOf("target_type" to "discussion", "target_id" to thread, "parent_id" to parentId, "user_id" to me, "body" to b, "has_spoilers" to spoilers).toJsonBody(), returning = false)
        Unit
    }

    // ------------------------------------------------------------ likes (solo reseñas, como la web)
    suspend fun toggleLike(type: String, id: String): Outcome<Boolean> = outcomeOf {
        if (type != "review") throw KazeException(KazeError.Validation("Solo se puede dar me gusta a reseñas."))
        val mine = sb.select("review_reactions", "review_id=eq.${enc(id)}&user_id=eq.$me&select=review_id", ListSerializer(Like.serializer()))
        if (mine.isNotEmpty()) {
            sb.delete("review_reactions", "review_id=eq.${enc(id)}&user_id=eq.$me"); false
        } else {
            sb.insert("review_reactions", mapOf("review_id" to id, "user_id" to me, "kind" to "like").toJsonBody(), returning = false); true
        }
    }

    suspend fun myLikes(): Outcome<Set<String>> = outcomeOf {
        sb.select("review_reactions", "user_id=eq.$me&select=review_id&limit=1000", ListSerializer(Like.serializer())).map { "review:${it.reviewId}" }.toSet()
    }

    /** La web exige un motivo de una lista cerrada; el texto libre va en `details`. */
    suspend fun report(type: String, id: String, reason: String) = outcomeOf {
        val r = SafeRichText.sanitizeUserInput(reason, 1000)
        if (r.length < 3) throw KazeException(KazeError.Validation("Cuéntale brevemente a los moderadores qué pasa."))
        val lower = r.lowercase()
        val code = when {
            "spam" in lower -> "spam"
            "spoiler" in lower -> "spoilers"
            listOf("acoso", "insult", "harass").any { it in lower } -> "harassment"
            listOf("odio", "hate", "racis").any { it in lower } -> "hate"
            listOf("sexual", "porno", "nsfw").any { it in lower } -> "sexual"
            else -> "other"
        }
        sb.insert("reports", mapOf("reporter_id" to me, "target_type" to type, "target_id" to id, "reason" to code, "details" to r).toJsonBody(), returning = false)
        Unit
    }

    // ------------------------------------------------------------ notifications
    private val notificationSelect = "id,kind,payload,read_at,created_at,actor:profiles!notifications_actor_id_fkey(*)"

    suspend fun notifications(): Outcome<List<AppNotification>> = outcomeOf {
        sb.select("notifications", "user_id=eq.$me&select=$notificationSelect&order=created_at.desc&limit=100", ListSerializer(AppNotification.serializer()))
    }

    suspend fun unreadSince(isoTime: String): Outcome<List<AppNotification>> = outcomeOf {
        sb.select("notifications", "user_id=eq.$me&read_at=is.null&created_at=gt.${enc(isoTime)}&select=$notificationSelect&order=created_at.desc&limit=20", ListSerializer(AppNotification.serializer()))
    }

    suspend fun markRead(id: String?) = outcomeOf {
        val filter = if (id == null) "user_id=eq.$me&read_at=is.null" else "id=eq.${enc(id)}"
        sb.update("notifications", filter, mapOf("read_at" to java.time.Instant.now().toString()).toJsonBody()); Unit
    }

    // ------------------------------------------------------------ account
    /** Igual que la web sin clave de servicio: borra todos los datos del usuario y cierra la sesión. */
    suspend fun deleteAccount(): Outcome<Unit> = outcomeOf {
        sb.rpc("delete_my_data")
        sb.clearSession()
        _myProfile.value = null
    }

    fun clearCache() { _myProfile.value = null }
}
