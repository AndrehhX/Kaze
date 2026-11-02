package com.kaze.mobile.feature.community

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.navigation.toRoute
import com.kaze.mobile.core.common.KazeError
import com.kaze.mobile.core.common.Outcome
import com.kaze.mobile.core.designsystem.components.AnimeImage
import com.kaze.mobile.core.designsystem.components.EmptyState
import com.kaze.mobile.core.designsystem.components.ErrorState
import com.kaze.mobile.core.designsystem.components.KazeButton
import com.kaze.mobile.core.designsystem.components.KazeButtonKind
import com.kaze.mobile.core.designsystem.components.KazeCard
import com.kaze.mobile.core.designsystem.components.KazeSpinner
import com.kaze.mobile.core.designsystem.components.KazeTopBar
import com.kaze.mobile.core.designsystem.components.Pill
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.core.text.SafeRichText
import com.kaze.mobile.data.anilist.AniListRepository
import com.kaze.mobile.domain.model.ReviewSummary
import com.kaze.mobile.navigation.ReviewsRoute
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.text.DateFormat
import java.util.Date
import javax.inject.Inject

data class ReviewsState(val items: List<ReviewSummary> = emptyList(), val page: Int = 0, val hasMore: Boolean = true, val loading: Boolean = false, val error: KazeError? = null)

@HiltViewModel
class AniListReviewsViewModel @Inject constructor(savedState: SavedStateHandle, private val repo: AniListRepository) : ViewModel() {
    private val mediaId: Int? = runCatching { savedState.toRoute<ReviewsRoute>().animeId }.getOrNull()
    private val _state = MutableStateFlow(ReviewsState())
    val state = _state.asStateFlow()

    init { loadMore() }

    fun loadMore() {
        val s = _state.value
        if (s.loading || !s.hasMore) return
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            when (val r = repo.reviews(s.page + 1, mediaId)) {
                is Outcome.Success -> _state.update { it.copy(items = (it.items + r.value.items).distinctBy { x -> x.id }, page = r.value.page, hasMore = r.value.hasNextPage, loading = false) }
                is Outcome.Failure -> _state.update { it.copy(loading = false, error = r.error) }
            }
        }
    }

    fun retry() { _state.update { it.copy(hasMore = true) }; loadMore() }
}

@Composable
fun AniListReviewsScreen(title: String?, onBack: () -> Unit, onOpenAnime: (Int) -> Unit, vm: AniListReviewsViewModel = hiltViewModel()) {
    Column(Modifier.fillMaxSize()) {
        KazeTopBar(title?.let { "Reviews · $it" } ?: "Community reviews", onBack, subtitle = "Written by AniList members")
        AniListReviewsList(vm, onOpenAnime)
    }
}

@Composable
fun AniListReviewsList(vm: AniListReviewsViewModel, onOpenAnime: (Int) -> Unit, state: LazyListState = rememberLazyListState(), header: (@Composable () -> Unit)? = null) {
    val s by vm.state.collectAsStateWithLifecycle()
    val nearEnd by remember { derivedStateOf { (state.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0) >= state.layoutInfo.totalItemsCount - 3 } }
    LaunchedEffect(nearEnd) { if (nearEnd) vm.loadMore() }
    LazyColumn(state = state, contentPadding = PaddingValues(bottom = 120.dp), modifier = Modifier.fillMaxSize()) {
        header?.let { item { it() } }
        items(s.items, key = { it.id }) { r -> ReviewCard(r, onOpenAnime) }
        when {
            s.loading -> item { Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) { KazeSpinner() } }
            s.error != null -> item { ErrorState(s.error!!.userMessage, onRetry = vm::retry, offline = s.error is KazeError.Offline) }
            s.items.isEmpty() -> item { EmptyState("No reviews yet", "Nobody has reviewed this on AniList.") }
        }
    }
}

@Composable
private fun ReviewCard(r: ReviewSummary, onOpenAnime: (Int) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    val c = Kaze.colors
    KazeCard(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp).animateContentSize(), onClick = { expanded = !expanded }, onClickLabel = if (expanded) "Colapsar reseña" else "Read full review") {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (r.mediaCover != null) {
                    Box(Modifier.width(40.dp).aspectRatio(0.7f).clip(Kaze.style.posterShape)) { AnimeImage(r.mediaCover, null, Modifier.fillMaxSize()) }
                    Spacer(Modifier.width(10.dp))
                }
                Column(Modifier.weight(1f)) {
                    r.mediaTitle?.let { Text(it, style = Kaze.type.titleSmall, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis) }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(18.dp).clip(CircleShape)) { AnimeImage(r.userAvatar, null, Modifier.fillMaxSize()) }
                        Spacer(Modifier.width(6.dp))
                        Text(r.userName + (r.createdAt?.let { " · " + DateFormat.getDateInstance(DateFormat.MEDIUM).format(Date(it * 1000)) } ?: ""), style = Kaze.type.bodySmall, color = c.textMuted)
                    }
                }
                r.score?.let { Pill("$it/100") }
            }
            Text(r.summary, style = Kaze.type.body, color = c.text)
            if (expanded && r.body != null) {
                Text(remember(r.id) { SafeRichText.htmlToPlain(r.body).replace(Regex("[#*_]{1,3}"), "") }, style = Kaze.type.bodySmall, color = c.text.copy(alpha = 0.9f))
                Text("Spoilers marked by the author are hidden.", style = Kaze.type.bodySmall, color = c.textMuted)
                r.mediaId?.let { KazeButton("Open anime", { onOpenAnime(it) }, kind = KazeButtonKind.Ghost) }
            }
            r.rating?.let { Text("$it de ${r.ratingAmount ?: it} encontraron esto útil", style = Kaze.type.bodySmall, color = c.textMuted) }
        }
    }
}
