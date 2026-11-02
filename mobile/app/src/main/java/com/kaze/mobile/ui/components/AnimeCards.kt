package com.kaze.mobile.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kaze.mobile.core.designsystem.components.AnimeImage
import com.kaze.mobile.core.designsystem.components.Pill
import com.kaze.mobile.core.designsystem.components.ProgressLine
import com.kaze.mobile.core.designsystem.components.ScoreBadge
import com.kaze.mobile.core.designsystem.components.SectionHeader
import com.kaze.mobile.core.designsystem.components.SkeletonBlock
import com.kaze.mobile.core.designsystem.components.parseHexColor
import com.kaze.mobile.core.designsystem.motion.pressScale
import com.kaze.mobile.core.designsystem.motion.staggeredReveal
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.core.designsystem.theme.Ornament
import com.kaze.mobile.domain.model.Anime
import com.kaze.mobile.ui.shared.sharedPoster

@Composable
fun PosterCard(
    anime: Anime,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    width: Dp? = 132.dp,
    sharedKey: String? = null,
    caption: String? = null,
    showTitle: Boolean = true,
) {
    val c = Kaze.colors
    val interaction = remember { MutableInteractionSource() }
    Column(
        modifier
            .then(if (width != null) Modifier.width(width) else Modifier)
            .pressScale(interaction)
            .clickable(interaction, indication = null, role = Role.Button, onClickLabel = "Open ${anime.displayTitle}", onClick = onClick)
            .semantics(mergeDescendants = true) { contentDescription = anime.displayTitle + (anime.score?.let { ", score $it percent" } ?: "") },
    ) {
        Box(
            Modifier
                .fillMaxWidth()
                .aspectRatio(0.7f)
                .sharedPoster(sharedKey)
                .clip(Kaze.style.posterShape)
                .then(if (Kaze.style.ornament == Ornament.CIRCUIT) Modifier.border(1.dp, c.primary.copy(alpha = 0.35f), Kaze.style.posterShape) else Modifier)
        ) {
            AnimeImage(anime.coverUrl, null, Modifier.fillMaxSize(), placeholderColor = parseHexColor(anime.color))
            ScoreBadge(anime.score, Modifier.align(Alignment.TopEnd).padding(6.dp), compact = true)
            if (anime.nextEpisode != null) {
                Pill("EP ${anime.nextEpisode - 1}", Modifier.align(Alignment.BottomStart).padding(6.dp), color = c.accent, overImage = true)
            }
        }
        if (showTitle) {
            Spacer(Modifier.height(8.dp))
            Text(anime.displayTitle, style = Kaze.type.titleSmall, color = c.text, maxLines = 2, overflow = TextOverflow.Ellipsis)
            val sub = caption ?: listOfNotNull(anime.formatLabel, anime.seasonYear ?: anime.startYear).joinToString(" · ")
            if (sub.isNotEmpty()) Text(sub, style = Kaze.type.bodySmall, color = c.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

/** Big outlined rank numerals behind posters — used for "Highest rated". */
@Composable
fun RankedPosterCard(rank: Int, anime: Anime, onClick: () -> Unit, sharedKey: String?) {
    val c = Kaze.colors
    Box(Modifier.width(170.dp)) {
        Text(
            "$rank",
            fontSize = 96.sp,
            fontWeight = FontWeight.Black,
            fontFamily = Kaze.style.displayFamily,
            color = c.primary.copy(alpha = 0.22f),
            style = Kaze.type.display.copy(shadow = Shadow(c.primary.copy(alpha = 0.4f), blurRadius = 18f)),
            modifier = Modifier.align(Alignment.BottomStart).offset(y = (-34).dp),
        )
        PosterCard(anime, onClick, Modifier.align(Alignment.TopEnd), width = 118.dp, sharedKey = sharedKey)
    }
}

@Composable
fun WideEpisodeCard(
    anime: Anime,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    progress: Float? = null,
    imageUrl: String? = anime.bannerUrl ?: anime.coverUrl,
) {
    val c = Kaze.colors
    val interaction = remember { MutableInteractionSource() }
    Column(
        modifier
            .width(260.dp)
            .pressScale(interaction)
            .clickable(interaction, null, role = Role.Button, onClickLabel = "Open ${anime.displayTitle}", onClick = onClick),
    ) {
        Box(Modifier.fillMaxWidth().aspectRatio(16f / 9f).clip(Kaze.style.cardShape)) {
            AnimeImage(imageUrl, null, Modifier.fillMaxSize(), placeholderColor = parseHexColor(anime.color))
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.75f)))))
            Box(
                Modifier.align(Alignment.Center).size(44.dp).clip(androidx.compose.foundation.shape.CircleShape)
                    .background(c.primary.copy(alpha = 0.9f)),
                contentAlignment = Alignment.Center,
            ) { Icon(Icons.Filled.PlayArrow, null, tint = c.onPrimary) }
            Text(label, style = Kaze.type.label, color = Color.White, modifier = Modifier.align(Alignment.BottomStart).padding(10.dp))
            if (progress != null) ProgressLine(progress, Modifier.align(Alignment.BottomCenter))
        }
        Spacer(Modifier.height(8.dp))
        Text(anime.displayTitle, style = Kaze.type.titleSmall, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
fun AnimeListRow(anime: Anime, onClick: () -> Unit, modifier: Modifier = Modifier, trailing: String? = null, sharedKey: String? = null) {
    val c = Kaze.colors
    val interaction = remember { MutableInteractionSource() }
    Row(
        modifier
            .fillMaxWidth()
            .pressScale(interaction, 0.98f)
            .clickable(interaction, null, role = Role.Button, onClickLabel = "Open ${anime.displayTitle}", onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.width(64.dp).aspectRatio(0.7f).sharedPoster(sharedKey).clip(Kaze.style.posterShape)) {
            AnimeImage(anime.coverUrl, null, Modifier.fillMaxSize(), placeholderColor = parseHexColor(anime.color))
        }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(anime.displayTitle, style = Kaze.type.titleSmall, color = c.text, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(
                listOfNotNull(anime.formatLabel, anime.seasonLabel, anime.episodes?.let { "$it eps" }).joinToString(" · "),
                style = Kaze.type.bodySmall, color = c.textMuted, maxLines = 1,
            )
            if (anime.genres.isNotEmpty()) Text(anime.genres.take(3).joinToString(" • "), style = Kaze.type.bodySmall, color = c.primary, maxLines = 1)
            if (trailing != null) Text(trailing, style = Kaze.type.bodySmall, color = c.textMuted, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
        ScoreBadge(anime.score, compact = true)
    }
}

/** A horizontal rail with header, loading skeletons and staggered reveal. */
fun LazyListScope.animeRail(
    key: String,
    title: String,
    items: List<Anime>?,
    onOpen: (Anime, String) -> Unit,
    subtitle: String? = null,
    index: Int? = null,
    onSeeAll: (() -> Unit)? = null,
    ranked: Boolean = false,
    captionFor: ((Anime) -> String?)? = null,
) {
    if (items != null && items.isEmpty()) return
    item(key = "$key-header", contentType = "header") { SectionHeader(title, subtitle = subtitle, index = index, onSeeAll = onSeeAll) }
    item(key = "$key-rail", contentType = "rail") {
        if (items == null) {
            LazyRow(contentPadding = PaddingValues(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(14.dp), userScrollEnabled = false) {
                items(5) { SkeletonBlock(Modifier.width(132.dp).aspectRatio(0.7f)) }
            }
        } else {
            LazyRow(contentPadding = PaddingValues(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                itemsIndexed(items, key = { _, a -> "$key-${a.id}" }) { i, a ->
                    val shared = "$key-${a.id}"
                    Box(Modifier.staggeredReveal(i)) {
                        if (ranked) RankedPosterCard(i + 1, a, { onOpen(a, shared) }, shared)
                        else PosterCard(a, { onOpen(a, shared) }, sharedKey = shared, caption = captionFor?.invoke(a))
                    }
                }
            }
        }
    }
}
