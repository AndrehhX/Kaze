package com.kaze.mobile.feature.community

import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.kaze.mobile.core.designsystem.components.KazeChip
import com.kaze.mobile.core.designsystem.theme.Kaze

data class CommunityTab(val title: String, val content: @Composable () -> Unit)

/** Community hub: AniList reviews are always available; KAZE social tabs are added by the shell. */
@Composable
fun CommunityScreen(onOpenAnime: (Int) -> Unit, extraTabs: List<CommunityTab>) {
    var tab by rememberSaveable { mutableIntStateOf(0) }
    val reviewsVm: AniListReviewsViewModel = hiltViewModel()
    val tabs = extraTabs + CommunityTab("AniList reviews") { AniListReviewsList(reviewsVm, onOpenAnime) }
    val c = Kaze.colors
    Column(Modifier.fillMaxSize()) {
        Column(Modifier.windowInsetsPadding(WindowInsets.statusBars).padding(start = 20.dp, top = 12.dp)) {
            Text(if (Kaze.style.uppercaseLabels) "COMMUNITY" else "Community", style = Kaze.type.display, color = c.text, modifier = Modifier.semantics { heading() })
            Text("Comenta anime. Oculta spoilers. Miren juntos.", style = Kaze.type.body, color = c.textMuted)
        }
        LazyRow(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            itemsIndexed(tabs) { i, t -> KazeChip(t.title, selected = i == tab.coerceAtMost(tabs.lastIndex), onClick = { tab = i }) }
        }
        AnimatedContent(tab.coerceAtMost(tabs.lastIndex), label = "community-tab") { i -> tabs[i].content() }
    }
}
