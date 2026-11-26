package com.kaze.mobile.data.backend

import android.content.Context
import com.kaze.mobile.core.database.CollectionDao
import com.kaze.mobile.core.database.CollectionEntity
import com.kaze.mobile.core.database.CollectionItemEntity
import com.kaze.mobile.domain.social.MediaSnap
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import java.time.Instant
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Serializable
private data class CloudCollectionItem(
    @SerialName("media_id") val mediaId: Int,
    val position: Int = 0,
    @SerialName("media_snapshot") val media: MediaSnap? = null,
)

@Serializable
private data class CloudCollection(
    val id: String,
    val name: String,
    val description: String = "",
    val color: String = DEFAULT_COLOR,
    @SerialName("is_public") val isPublic: Boolean = false,
    @SerialName("updated_at") val updatedAt: String,
    @SerialName("collection_items") val items: List<CloudCollectionItem> = emptyList(),
)

private const val DEFAULT_COLOR = "#a855f7"
private const val COLS = "id,name,description,color,is_public,updated_at,collection_items(media_id,position,media_snapshot)"

/**
 * Sincroniza tus listas (colecciones) con las de KAZE Web: las mismas tablas `anime_collections`
 * y `collection_items`. Lo que creas, cambias o borras en un lado aparece igual en el otro.
 *
 * Sin tocar la base de datos del teléfono: el enlace "lista del teléfono ↔ lista de la web" y una
 * huella de la última versión sincronizada se guardan aparte. Con esa huella se sabe qué lado cambió;
 * si cambiaron los dos, gana el cambio más reciente (igual que la biblioteca).
 */
@Singleton
class CloudCollectionsSync @Inject constructor(
    private val sb: SupabaseClient,
    private val dao: CollectionDao,
    private val json: Json,
    @ApplicationContext context: Context,
) {
    private val prefs = context.getSharedPreferences("kaze_collections_sync", Context.MODE_PRIVATE)
    private val mapSer = MapSerializer(String.serializer(), String.serializer())

    private fun load(key: String): MutableMap<String, String> =
        prefs.getString(key, null)?.let { runCatching { json.decodeFromString(mapSer, it) }.getOrNull() }?.toMutableMap() ?: mutableMapOf()

    private fun save(key: String, map: Map<String, String>) = prefs.edit().putString(key, json.encodeToString(mapSer, map)).apply()

    /** Si en este teléfono cambió la cuenta, se olvidan los enlaces anteriores. */
    fun resetFor(userId: String) {
        if (prefs.getString(KEY_USER, null) != userId) prefs.edit().clear().putString(KEY_USER, userId).apply()
    }

    private fun fingerprint(name: String, description: String, isPublic: Boolean, ids: List<Int>) =
        "$name\u0001$description\u0001$isPublic\u0001${ids.joinToString(",")}".hashCode().toString()

    /** Devuelve (bajadas, subidas, borradas). */
    suspend fun sync(me: String): Triple<Int, Int, Int> {
        resetFor(me)
        val remote = sb.select("anime_collections", "user_id=eq.$me&select=$COLS&limit=200", ListSerializer(CloudCollection.serializer()))
            .associateBy { it.id }
        val links = load(KEY_LINKS)          // id local -> id web
        val synced = load(KEY_SYNCED)        // id web -> huella de la última versión sincronizada
        val local = dao.allCollections()
        val items = dao.allItems().groupBy { it.collectionId }
        var pulled = 0; var pushed = 0; var deleted = 0

        for (c in local) {
            val its = items[c.id].orEmpty().sortedBy { it.position }
            val localFp = fingerprint(c.name, c.description, c.isPublic, its.map { it.animeId })
            val rid = links[c.id.toString()]
            val r = rid?.let { remote[it] }
            when {
                rid == null -> {                                   // nueva en el teléfono
                    val newId = UUID.randomUUID().toString()
                    push(me, newId, c, its, DEFAULT_COLOR)
                    links[c.id.toString()] = newId; synced[newId] = localFp; pushed++
                }
                r == null -> {                                     // ya no está en la web
                    if (synced[rid] == localFp) { dao.deleteCollectionCascade(c.id); links.remove(c.id.toString()); synced.remove(rid); deleted++ }
                    else { push(me, rid, c, its, DEFAULT_COLOR); synced[rid] = localFp; pushed++ } // la cambiaste aquí: se vuelve a subir
                }
                else -> {
                    val remoteIds = r.items.sortedBy { it.position }.map { it.mediaId }
                    val remoteFp = fingerprint(r.name, r.description, r.isPublic, remoteIds)
                    val localChanged = synced[rid] != localFp
                    val remoteChanged = synced[rid] != remoteFp
                    val remoteNewer = parseIsoMillis(r.updatedAt) > c.updatedAt
                    when {
                        localFp == remoteFp -> synced[rid] = localFp
                        localChanged && (!remoteChanged || !remoteNewer) -> { push(me, rid, c, its, r.color); synced[rid] = localFp; pushed++ }
                        else -> { applyRemote(c.id, r); synced[rid] = remoteFp; pulled++ }
                    }
                }
            }
        }
        // Listas de la web que el teléfono no tiene.
        val linkedRemote = links.values.toSet()
        for (r in remote.values) {
            if (r.id in linkedRemote) continue
            if (r.id in synced) {                                  // la borraste en el teléfono
                sb.delete("anime_collections", "id=eq.${r.id}&user_id=eq.$me"); synced.remove(r.id); deleted++
            } else {                                               // nueva en la web
                val now = parseIsoMillis(r.updatedAt)
                val id = dao.insertCollection(CollectionEntity(name = r.name.take(60), description = r.description.take(280), position = dao.maxCollectionPosition() + 1, isPublic = r.isPublic, createdAt = now, updatedAt = now))
                applyItems(id, r)
                links[id.toString()] = r.id
                synced[r.id] = fingerprint(r.name, r.description, r.isPublic, r.items.sortedBy { it.position }.map { it.mediaId }); pulled++
            }
        }
        save(KEY_LINKS, links); save(KEY_SYNCED, synced)
        return Triple(pulled, pushed, deleted)
    }

    private suspend fun push(me: String, rid: String, c: CollectionEntity, its: List<CollectionItemEntity>, color: String) {
        sb.insert(
            "anime_collections?on_conflict=id",
            mapOf(
                "id" to rid, "user_id" to me, "name" to c.name.take(60).ifBlank { "Mi lista" }, "description" to c.description.take(400),
                "color" to color, "is_public" to c.isPublic, "updated_at" to Instant.ofEpochMilli(c.updatedAt).toString(),
            ).toJsonBody(),
            returning = false, upsert = true,
        )
        sb.delete("collection_items", "collection_id=eq.$rid")
        if (its.isNotEmpty()) {
            val body = "[" + its.mapIndexed { i, it ->
                mapOf(
                    "collection_id" to rid, "media_id" to it.animeId, "position" to i,
                    "media_snapshot" to mapOf("title" to it.title, "cover" to it.coverUrl, "color" to it.color),
                ).toJsonBody()
            }.joinToString(",") + "]"
            sb.insert("collection_items", body, returning = false)
        }
    }

    private suspend fun applyRemote(localId: Long, r: CloudCollection) {
        val current = dao.allCollections().firstOrNull { it.id == localId } ?: return
        dao.upsertCollection(current.copy(name = r.name.take(60), description = r.description.take(280), isPublic = r.isPublic, updatedAt = parseIsoMillis(r.updatedAt)))
        applyItems(localId, r)
    }

    private suspend fun applyItems(localId: Long, r: CloudCollection) {
        val old = dao.allItems().filter { it.collectionId == localId }.associateBy { it.animeId }
        dao.deleteItemsOf(localId)
        dao.upsertItems(r.items.sortedBy { it.position }.mapIndexed { i, it ->
            val prev = old[it.mediaId]
            CollectionItemEntity(
                collectionId = localId, animeId = it.mediaId,
                title = it.media?.title ?: prev?.title ?: "Anime #${it.mediaId}",
                coverUrl = it.media?.cover ?: prev?.coverUrl, color = it.media?.color ?: prev?.color,
                position = i, addedAt = prev?.addedAt ?: System.currentTimeMillis(),
            )
        })
    }

    private companion object {
        const val KEY_USER = "user"
        const val KEY_LINKS = "links"
        const val KEY_SYNCED = "synced"
    }
}
