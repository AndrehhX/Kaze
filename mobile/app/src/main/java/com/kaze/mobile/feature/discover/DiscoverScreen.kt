package com.kaze.mobile.feature.discover

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountTree
import androidx.compose.material.icons.filled.Biotech
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Casino
import androidx.compose.material.icons.filled.Mood
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.kaze.mobile.core.designsystem.components.KazeCard
import com.kaze.mobile.core.designsystem.motion.staggeredReveal
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.domain.model.AniListCatalog

data class DiscoverTool(val title: String, val subtitle: String, val icon: ImageVector, val onClick: () -> Unit)

@Composable
fun DiscoverScreen(
    columns: Int,
    onSearch: () -> Unit,
    onGenre: (String) -> Unit,
    onMood: () -> Unit,
    onRoulette: () -> Unit,
    onSeasonal: () -> Unit,
    onSimilarity: () -> Unit,
    onDna: () -> Unit,
) {
    val c = Kaze.colors
    val tools = listOf(
        DiscoverTool("Explorador de emociones", "Elige cómo te sientes y obtén recomendaciones", Icons.Filled.Mood, onMood),
        DiscoverTool("Ruleta de anime", "Deja que el destino elija qué ver hoy", Icons.Filled.Casino, onRoulette),
        DiscoverTool("Temporadas", "Todas las temporadas de cada año", Icons.Filled.CalendarMonth, onSeasonal),
        DiscoverTool("Explorador de similitud", "Navega la red de animes relacionados", Icons.Filled.AccountTree, onSimilarity),
        DiscoverTool("ADN del anime", "Tus gustos descifrados desde tu biblioteca", Icons.Filled.Biotech, onDna),
    )
    LazyVerticalGrid(
        columns = GridCells.Fixed(columns),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 120.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.fillMaxSize(),
    ) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            Column(Modifier.windowInsetsPadding(WindowInsets.statusBars).padding(top = 16.dp)) {
                Text(if (Kaze.style.uppercaseLabels) "EXPLORAR" else "Explorar", style = Kaze.type.display, color = c.text, modifier = Modifier.semantics { heading() })
                Text("Encuentra tu próxima obsesión", style = Kaze.type.body, color = c.textMuted)
                Spacer(Modifier.height(16.dp))
                Row(
                    Modifier.fillMaxWidth().height(52.dp).clip(Kaze.style.chipShape).background(c.surfaceHigh)
                        .border(1.dp, c.outline, Kaze.style.chipShape)
                        .clickable(role = Role.Button, onClickLabel = "Abrir búsqueda", onClick = onSearch)
                        .padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Filled.Search, null, tint = c.primary)
                    Spacer(Modifier.width(10.dp))
                    Text("Buscar entre más de 20,000 animes", style = Kaze.type.body, color = c.textMuted)
                }
                Spacer(Modifier.height(8.dp))
            }
        }
        items(tools.size, span = { i -> GridItemSpan(if (i == 0 && columns > 1) 2.coerceAtMost(columns) else 1) }) { i ->
            val t = tools[i]
            KazeCard(Modifier.fillMaxWidth().height(132.dp).staggeredReveal(i), onClick = t.onClick, onClickLabel = t.title, highlighted = i == 0) {
                Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.SpaceBetween) {
                    Box(Modifier.size(40.dp).clip(Kaze.style.chipShape).background(c.primary.copy(alpha = 0.16f)), contentAlignment = Alignment.Center) {
                        Icon(t.icon, null, tint = c.primary)
                    }
                    Column {
                        Text(t.title, style = Kaze.type.title, color = c.text, maxLines = 1)
                        Text(t.subtitle, style = Kaze.type.bodySmall, color = c.textMuted, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
        item(span = { GridItemSpan(maxLineSpan) }) {
            Text("Explorar por género", style = Kaze.type.headline, color = c.text, modifier = Modifier.padding(top = 16.dp).semantics { heading() })
        }
        items(AniListCatalog.genres.filterNot { it == "Ecchi" }) { g ->
            GenreTile(g) { onGenre(g) }
        }
    }
}

@Composable
private fun GenreTile(genre: String, onClick: () -> Unit) {
    val c = Kaze.colors
    val hue = (genre.hashCode() and 0xFF) / 255f
    val tint = Color.hsv(hue * 360f, 0.55f, 0.75f)
    Box(
        Modifier.fillMaxWidth().aspectRatio(2.2f).clip(Kaze.style.cardShape)
            .background(Brush.linearGradient(listOf(tint.copy(alpha = 0.55f), c.primary.copy(alpha = 0.25f), c.surface)))
            .clickable(role = Role.Button, onClickLabel = "Explorar $genre", onClick = onClick)
            .padding(14.dp),
        contentAlignment = Alignment.BottomStart,
    ) {
        Text(if (Kaze.style.uppercaseLabels) genre.uppercase() else genre, style = Kaze.type.title, color = c.text)
    }
}
