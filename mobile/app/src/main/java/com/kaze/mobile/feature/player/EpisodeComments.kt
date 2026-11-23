package com.kaze.mobile.feature.player

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.kaze.mobile.core.common.Outcome
import com.kaze.mobile.core.designsystem.components.KazeButton
import com.kaze.mobile.core.designsystem.components.KazeSpinner
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.data.backend.SocialRepository
import com.kaze.mobile.domain.social.Comment
import com.kaze.mobile.feature.social.Avatar
import com.kaze.mobile.feature.social.relativeTime
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class EpisodeCommentsState(
    val key: String? = null,
    val loading: Boolean = false,
    val comments: List<Comment> = emptyList(),
    val error: String? = null,
    val posting: Boolean = false,
)

/** Comentarios del episodio: el mismo hilo que la web muestra debajo del reproductor. */
@HiltViewModel
class EpisodeCommentsViewModel @Inject constructor(private val social: SocialRepository) : ViewModel() {
    private val _state = MutableStateFlow(EpisodeCommentsState())
    val state: StateFlow<EpisodeCommentsState> = _state.asStateFlow()
    val signedIn: Boolean get() = social.isAvailable

    fun load(animeId: Int, episode: Int, force: Boolean = false) {
        val key = "$animeId:$episode"
        if (!force && _state.value.key == key) return
        _state.value = EpisodeCommentsState(key = key, loading = true)
        viewModelScope.launch {
            _state.value = when (val r = social.episodeComments(animeId, episode)) {
                is Outcome.Success -> _state.value.copy(loading = false, comments = r.value)
                is Outcome.Failure -> _state.value.copy(loading = false, error = r.error.userMessage)
            }
        }
    }

    fun post(animeId: Int, episode: Int, title: String, cover: String?, body: String, spoilers: Boolean, onDone: () -> Unit) {
        _state.value = _state.value.copy(posting = true, error = null)
        viewModelScope.launch {
            when (val r = social.postEpisodeComment(animeId, episode, title, cover, body, spoilers)) {
                is Outcome.Success -> { onDone(); _state.value = _state.value.copy(posting = false); load(animeId, episode, force = true) }
                is Outcome.Failure -> _state.value = _state.value.copy(posting = false, error = r.error.userMessage)
            }
        }
    }
}

@Composable
fun EpisodeCommentsSection(request: PlaybackRequest, vm: EpisodeCommentsViewModel = hiltViewModel()) {
    val c = Kaze.colors
    val state by vm.state.collectAsStateWithLifecycle()
    LaunchedEffect(request.animeId, request.episode) { vm.load(request.animeId, request.episode) }
    var text by rememberSaveable(request.animeId, request.episode) { mutableStateOf("") }
    var spoilers by rememberSaveable(request.animeId, request.episode) { mutableStateOf(false) }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Comentarios del episodio ${request.episode}", style = Kaze.type.title, color = c.text)
        if (vm.signedIn) {
            Column(Modifier.fillMaxWidth().clip(Kaze.style.cardShape).background(c.surfaceHigh).padding(12.dp)) {
                BasicTextField(
                    text, { text = it.take(4000) },
                    textStyle = Kaze.type.body.copy(color = c.text), cursorBrush = SolidColor(c.primary),
                    modifier = Modifier.fillMaxWidth().heightIn(min = 44.dp).semantics { contentDescription = "Escribe un comentario" },
                    decorationBox = { inner -> if (text.isEmpty()) Text("¿Qué te pareció el episodio?", style = Kaze.type.body, color = c.textMuted); inner() },
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Row(Modifier.weight(1f).clickable { spoilers = !spoilers }, verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(spoilers, { spoilers = it }, colors = CheckboxDefaults.colors(checkedColor = c.primary))
                        Text("Contiene spoilers", style = Kaze.type.bodySmall, color = c.textMuted)
                    }
                    KazeButton(
                        "Publicar",
                        { vm.post(request.animeId, request.episode, request.title, request.coverUrl, text, spoilers) { text = ""; spoilers = false } },
                        enabled = text.isNotBlank() && !state.posting, loading = state.posting,
                    )
                }
            }
        } else {
            Text("Inicia sesión para comentar. Los comentarios son los mismos que en la web.", style = Kaze.type.bodySmall, color = c.textMuted)
        }
        state.error?.let { Text(it, style = Kaze.type.bodySmall, color = c.error) }
        when {
            state.loading -> KazeSpinner(Modifier.padding(8.dp).size(28.dp))
            state.comments.isEmpty() -> Text("Aún no hay comentarios. ¡Sé el primero!", style = Kaze.type.bodySmall, color = c.textMuted)
            else -> state.comments.forEach { CommentRow(it) }
        }
    }
}

@Composable
private fun CommentRow(comment: Comment) {
    val c = Kaze.colors
    var revealed by remember(comment.id) { mutableStateOf(!comment.hasSpoilers) }
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Avatar(comment.author, 34)
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(comment.author?.name ?: "Usuario", style = Kaze.type.titleSmall, color = c.text)
                Spacer(Modifier.width(8.dp))
                Text(relativeTime(comment.createdAt), style = Kaze.type.bodySmall, color = c.textMuted)
            }
            if (revealed) Text(comment.body, style = Kaze.type.body, color = c.text)
            else Text(
                "Spoiler oculto · toca para verlo", style = Kaze.type.bodySmall, color = c.primary,
                modifier = Modifier.clip(Kaze.style.chipShape).background(c.surfaceHigh).clickable { revealed = true }.padding(horizontal = 10.dp, vertical = 6.dp),
            )
        }
    }
}
