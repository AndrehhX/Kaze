package com.kaze.mobile.data.backend

import android.content.Context
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import com.kaze.mobile.BuildConfig
import com.kaze.mobile.CallbackHandler
import com.kaze.mobile.core.common.KazeError
import com.kaze.mobile.core.common.KazeException
import com.kaze.mobile.core.common.Outcome
import com.kaze.mobile.core.common.outcomeOf
import com.kaze.mobile.core.di.ApplicationScope
import com.kaze.mobile.core.security.TokenStore
import com.kaze.mobile.data.anilist.AniListClient
import com.kaze.mobile.data.anilist.AniListQueries
import com.kaze.mobile.data.anilist.ListsData
import com.kaze.mobile.data.anilist.SaveEntryData
import com.kaze.mobile.data.anilist.ViewerData
import com.kaze.mobile.data.anilist.ViewerDto
import com.kaze.mobile.data.anilist.toAnime
import com.kaze.mobile.data.library.LibraryRepository
import com.kaze.mobile.domain.model.Anime
import com.kaze.mobile.domain.model.LibraryEntry
import com.kaze.mobile.domain.model.LibraryStatus
import com.kaze.mobile.domain.sync.ConflictChoice
import com.kaze.mobile.domain.sync.RemoteEntry
import com.kaze.mobile.domain.sync.SyncConflict
import com.kaze.mobile.domain.sync.SyncPlan
import com.kaze.mobile.domain.sync.SyncPlanner
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

data class AniListAccount(val id: Int, val name: String, val avatar: String?)

data class AniListSyncPreview(val plan: SyncPlan, val metadata: Map<Int, Anime>, val favoriteIds: Set<Int>)

/**
 * AniList account link using AniList's implicit OAuth grant (the documented flow for clients
 * without a server). No client secret exists in the app. The token is accepted only while a
 * flow we started is pending (10-minute window) and only after AniList confirms it via Viewer.
 */
@Singleton
class AniListAuthRepository @Inject constructor(
    private val client: AniListClient,
    private val store: TokenStore,
    private val library: LibraryRepository,
    private val json: Json,
    @ApplicationScope private val scope: CoroutineScope,
) : CallbackHandler {

    @Serializable private data class StoredAccount(val id: Int, val name: String, val avatar: String?)

    private val _account = MutableStateFlow(store.get(KEY_ACCOUNT)?.let { runCatching { json.decodeFromString(StoredAccount.serializer(), it) }.getOrNull() }?.let { AniListAccount(it.id, it.name, it.avatar) })
    val account = _account.asStateFlow()

    private val _events = Channel<String>(Channel.BUFFERED)
    val events = _events.receiveAsFlow()

    val clientId: String = BuildConfig.ANILIST_CLIENT_ID
    val isConfigured: Boolean get() = clientId.isNotBlank()

    private var pendingSince = 0L

    fun startAuthorization(context: Context) {
        if (!isConfigured) return
        pendingSince = System.currentTimeMillis()
        val url = Uri.parse("https://anilist.co/api/v2/oauth/authorize").buildUpon()
            .appendQueryParameter("client_id", clientId)
            .appendQueryParameter("response_type", "token")
            .build()
        CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(context, url)
    }

    override val host = "anilist-callback"

    override fun handle(uri: Uri): Boolean {
        val pending = System.currentTimeMillis() - pendingSince < 10 * 60_000
        pendingSince = 0
        val params = uri.fragment?.let { Uri.parse("x://x?$it") }
        val token = params?.getQueryParameter("access_token")
        scope.launch {
            if (!pending) { _events.send("Ignored an AniList sign-in link that KAZE didn't request."); return@launch }
            if (token.isNullOrBlank() || token.length > 4096) { _events.send(uri.getQueryParameter("error_description") ?: "AniList didn't return a token."); return@launch }
            when (val r = outcomeOf { client.execute(AniListQueries.VIEWER, emptyMap(), ViewerData.serializer(), token).data.Viewer ?: throw KazeException(KazeError.Unauthorized) }) {
                is Outcome.Success -> { save(token, r.value); _events.send("Connected AniList as ${r.value.name}") }
                is Outcome.Failure -> _events.send("AniList rejected the token: ${r.error.userMessage}")
            }
        }
        return true
    }

    private fun save(token: String, v: ViewerDto) {
        store.put(KEY_TOKEN, token)
        val acc = StoredAccount(v.id, v.name, v.avatar?.large)
        store.put(KEY_ACCOUNT, json.encodeToString(StoredAccount.serializer(), acc))
        _account.value = AniListAccount(acc.id, acc.name, acc.avatar)
    }

    fun disconnect() {
        store.clear(KEY_TOKEN, KEY_ACCOUNT)
        _account.value = null
    }

    private fun token(): String = store.get(KEY_TOKEN) ?: throw KazeException(KazeError.Unauthorized)

    /** Builds a preview of what syncing would do — nothing is written until [apply]. */
    suspend fun preview(): Outcome<AniListSyncPreview> = outcomeOf {
        val acc = _account.value ?: throw KazeException(KazeError.Unauthorized)
        val data = try {
            client.execute(AniListQueries.VIEWER_LISTS, mapOf("userId" to acc.id), ListsData.serializer(), token()).data
        } catch (e: KazeException) {
            if (e.error is KazeError.Unauthorized) disconnect() // token revoked/expired
            throw e
        }
        val favs = data.Viewer?.favourites?.anime?.nodes.orEmpty().map { it.id }.toSet()
        val entries = data.MediaListCollection?.lists.orEmpty().flatMap { it.entries }.filter { it.media?.isAdult != true }
        val metadata = entries.mapNotNull { e -> e.media?.toAnime()?.let { it.id to it } }.toMap()
        val remote = entries.mapNotNull { e ->
            val media = e.media ?: return@mapNotNull null
            RemoteEntry(
                animeId = media.id,
                status = LibraryStatus.fromAniList(e.status) ?: return@mapNotNull null,
                progress = e.progress ?: 0,
                score = e.score?.toInt()?.takeIf { it > 0 },
                updatedAt = e.updatedAt ?: 0,
                isFavorite = media.id in favs,
            )
        }
        AniListSyncPreview(SyncPlanner.plan(library.snapshot(), remote), metadata, favs)
    }

    data class SyncResult(val pulled: Int, val pushed: Int, val resolved: Int, val failed: Int)

    /** Applies a previewed plan. Pushes are paced to respect AniList's rate limit. */
    suspend fun apply(preview: AniListSyncPreview, choices: Map<Int, ConflictChoice>, push: Boolean): Outcome<SyncResult> = outcomeOf {
        val plan = preview.plan
        library.applyRemote(plan.pull, preview.metadata)
        var resolved = 0
        val extraPush = mutableListOf<LibraryEntry>()
        plan.conflicts.forEach { c: SyncConflict ->
            when (choices[c.local.animeId]) {
                ConflictChoice.USE_REMOTE -> { library.resolveConflict(c, ConflictChoice.USE_REMOTE, preview.metadata[c.local.animeId]); resolved++ }
                ConflictChoice.KEEP_LOCAL -> { library.resolveConflict(c, ConflictChoice.KEEP_LOCAL, null); extraPush += c.local; resolved++ }
                null -> Unit // left unresolved on purpose: nothing overwritten
            }
        }
        var pushed = 0; var failed = 0
        if (push) {
            (plan.push + extraPush).forEach { e ->
                val r = outcomeOf {
                    client.execute(AniListQueries.SAVE_ENTRY, mapOf("mediaId" to e.animeId, "status" to e.status.anilist, "progress" to e.progress, "score" to e.userScore?.toDouble()), SaveEntryData.serializer(), token())
                        .data.SaveMediaListEntry
                }
                if (r is Outcome.Success && r.value != null) { library.markPushed(e.animeId, r.value.updatedAt ?: (System.currentTimeMillis() / 1000)); pushed++ } else failed++
                delay(750)
            }
        }
        SyncResult(plan.pull.size, pushed, resolved, failed)
    }

    private companion object {
        const val KEY_TOKEN = "anilist_token"
        const val KEY_ACCOUNT = "anilist_account"
    }
}
