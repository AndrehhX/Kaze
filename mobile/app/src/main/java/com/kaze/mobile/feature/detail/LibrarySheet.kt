package com.kaze.mobile.feature.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import com.kaze.mobile.core.designsystem.components.KazeButton
import com.kaze.mobile.core.designsystem.components.KazeButtonKind
import com.kaze.mobile.core.designsystem.components.KazeChip
import com.kaze.mobile.core.designsystem.components.KazeIconButton
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.domain.model.Anime
import com.kaze.mobile.domain.model.AnimeCollection
import com.kaze.mobile.domain.model.LibraryEntry
import com.kaze.mobile.domain.model.LibraryStatus
import kotlin.math.roundToInt

/** Every library action for one title, reachable without gestures. */
@Composable
fun LibrarySheet(
    anime: Anime,
    entry: LibraryEntry?,
    collections: List<AnimeCollection>,
    inCollections: List<Long>,
    onStatus: (LibraryStatus) -> Unit,
    onProgress: (Int) -> Unit,
    onScore: (Int?) -> Unit,
    onFavorite: () -> Unit,
    onToggleCollection: (Long) -> Unit,
    onCreateCollection: (String) -> Unit,
    onRemove: () -> Unit,
    onDismiss: () -> Unit,
) {
    val c = Kaze.colors
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var score by remember(entry?.userScore) { mutableFloatStateOf((entry?.userScore ?: 0).toFloat()) }
    var newCollection by remember { mutableStateOf("") }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheet, containerColor = c.surface, shape = Kaze.style.sheetShape) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 36.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text(anime.displayTitle, style = Kaze.type.headline, color = c.text)
            Text("Estado", style = Kaze.type.title, color = c.text)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                LibraryStatus.entries.forEach { s ->
                    KazeChip(s.label, selected = entry?.status == s, icon = if (entry?.status == s) Icons.Filled.Check else null, onClick = { onStatus(s) })
                }
            }
            val total = anime.episodes
            Text("Progreso", style = Kaze.type.title, color = c.text)
            Row(verticalAlignment = Alignment.CenterVertically) {
                val p = entry?.progress ?: 0
                KazeIconButton(Icons.Filled.Remove, "Un episodio menos", { onProgress(p - 1) }, enabled = p > 0, background = c.surfaceHigh)
                Text(
                    "Episodio $p" + (total?.let { " de $it" } ?: ""),
                    style = Kaze.type.title, color = c.text,
                    modifier = Modifier.weight(1f).padding(horizontal = 12.dp).semantics { stateDescription = "Episodio $p" },
                )
                KazeIconButton(Icons.Filled.Add, "Un episodio más", { onProgress(p + 1) }, enabled = total == null || p < total, background = c.primary.copy(alpha = 0.2f))
            }
            if (total != null && total > 1) KazeButton("Marcar los $total como vistos", { onProgress(total) }, kind = KazeButtonKind.Ghost)

            Text("Tu calificación: ${if (score <= 0f) "sin calificar" else "${score.roundToInt()}/100"}", style = Kaze.type.title, color = c.text)
            Slider(
                value = score,
                onValueChange = { score = (it / 5).roundToInt() * 5f },
                onValueChangeFinished = { onScore(score.roundToInt().takeIf { it > 0 }) },
                valueRange = 0f..100f,
                steps = 19,
                colors = SliderDefaults.colors(thumbColor = c.primary, activeTrackColor = c.primary),
                modifier = Modifier.semantics { contentDescription = "Tu calificación de 0 a 100" },
            )
            KazeButton(
                if (entry?.isFavorite == true) "En favoritos" else "Añadir a favoritos", onFavorite,
                icon = if (entry?.isFavorite == true) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
                kind = KazeButtonKind.Secondary,
            )

            Text("Colecciones", style = Kaze.type.title, color = c.text)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                collections.forEach { col ->
                    val inIt = col.id in inCollections
                    KazeChip(col.name, selected = inIt, icon = if (inIt) Icons.Filled.Check else Icons.Filled.Add, onClick = { onToggleCollection(col.id) })
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Row(Modifier.weight(1f).height(48.dp).background(c.surfaceHigh, Kaze.style.chipShape).padding(horizontal = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (newCollection.isEmpty()) Text("Nombre de la nueva colección", style = Kaze.type.bodySmall, color = c.textMuted)
                    BasicTextField(
                        newCollection, { newCollection = it.take(60) }, singleLine = true,
                        textStyle = Kaze.type.body.copy(color = c.text), cursorBrush = SolidColor(c.primary),
                        modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Nombre de la nueva colección" },
                    )
                }
                Spacer(Modifier.width(8.dp))
                KazeButton("Crear", { onCreateCollection(newCollection); newCollection = "" }, enabled = newCollection.isNotBlank())
            }
            if (entry != null) KazeButton("Eliminar de la biblioteca", onRemove, icon = Icons.Filled.Delete, kind = KazeButtonKind.Ghost)
        }
    }
}
