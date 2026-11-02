package com.kaze.mobile.feature.library

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CollectionsBookmark
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Public
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.kaze.mobile.core.designsystem.components.AnimeImage
import com.kaze.mobile.core.designsystem.components.EmptyState
import com.kaze.mobile.core.designsystem.components.KazeButton
import com.kaze.mobile.core.designsystem.components.KazeButtonKind
import com.kaze.mobile.core.designsystem.components.KazeCard
import com.kaze.mobile.core.designsystem.components.KazeIconButton
import com.kaze.mobile.core.designsystem.components.KazeSpinner
import com.kaze.mobile.core.designsystem.components.KazeTopBar
import com.kaze.mobile.core.designsystem.components.parseHexColor
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.domain.model.AnimeCollection

@Composable
fun CollectionsScreen(onBack: () -> Unit, onOpen: (Long) -> Unit, vm: CollectionsViewModel = hiltViewModel()) {
    val collections by vm.collections.collectAsStateWithLifecycle()
    val error by vm.error.collectAsStateWithLifecycle()
    var creating by rememberSaveable { mutableStateOf(false) }
    var deleting by remember { mutableStateOf<AnimeCollection?>(null) }
    val c = Kaze.colors
    Column(Modifier.fillMaxSize()) {
        KazeTopBar("Collections", onBack, subtitle = "Curate your own lists", actions = { KazeIconButton(Icons.Filled.Add, "Nueva colección", { creating = true }) })
        val list = collections
        when {
            list == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { KazeSpinner() }
            list.isEmpty() -> EmptyState("No collections yet", "Group anime any way you like — \"Rainy day comfort\", \"Best openings\", \"Show my friends\".", icon = Icons.Filled.CollectionsBookmark, action = "Crear colección", onAction = { creating = true })
            else -> LazyColumn(contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 120.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(list, key = { it.id }) { col ->
                    KazeCard(Modifier.fillMaxWidth().animateItem(), onClick = { onOpen(col.id) }, onClickLabel = "Open ${col.name}") {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            CoverStack(col)
                            Spacer(Modifier.width(16.dp))
                            Column(Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(if (col.isPublic) Icons.Filled.Public else Icons.Filled.Lock, if (col.isPublic) "Public" else "Private", tint = c.textMuted, modifier = Modifier.size(14.dp))
                                    Spacer(Modifier.width(4.dp))
                                    Text(col.name, style = Kaze.type.title, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                }
                                Text("${col.items.size} anime", style = Kaze.type.bodySmall, color = c.textMuted)
                                if (col.description.isNotBlank()) Text(col.description, style = Kaze.type.bodySmall, color = c.textMuted, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            }
                            Column {
                                KazeIconButton(Icons.Filled.KeyboardArrowUp, "Move ${col.name} up", { vm.move(col.id, -1) })
                                KazeIconButton(Icons.Filled.KeyboardArrowDown, "Move ${col.name} down", { vm.move(col.id, 1) })
                            }
                            KazeIconButton(Icons.Filled.Delete, "Eliminar ${col.name}", { deleting = col }, tint = c.error)
                        }
                    }
                }
            }
        }
    }
    if (creating) CollectionEditor("Nueva colección", "", "", false, error, onSave = { n, d, p -> vm.create(n, d, p); creating = false }, onDismiss = { creating = false })
    deleting?.let { col ->
        AlertDialog(
            onDismissRequest = { deleting = null },
            title = { Text("¿Eliminar «${col.name}»?") },
            text = { Text("Los animes permanecerán en tu biblioteca; solo se eliminará esta colección.") },
            confirmButton = { TextButton({ vm.delete(col.id); deleting = null }) { Text("Delete", color = c.error) } },
            dismissButton = { TextButton({ deleting = null }) { Text("Cancel") } },
            containerColor = c.surface,
        )
    }
}

@Composable
private fun CoverStack(col: AnimeCollection) {
    Box(Modifier.width(92.dp).height(84.dp)) {
        col.items.take(3).forEachIndexed { i, item ->
            Box(
                Modifier.offset(x = (i * 18).dp).width(56.dp).aspectRatio(0.7f)
                    .graphicsLayer { rotationZ = (i - 1) * 6f }
                    .clip(Kaze.style.posterShape)
            ) { AnimeImage(item.coverUrl, null, Modifier.fillMaxSize(), placeholderColor = parseHexColor(item.color)) }
        }
        if (col.items.isEmpty()) Box(Modifier.width(56.dp).aspectRatio(0.7f).clip(Kaze.style.posterShape).background(Kaze.colors.surfaceHigh))
    }
}

@Composable
private fun CollectionEditor(title: String, name0: String, desc0: String, public0: Boolean, error: String?, onSave: (String, String, Boolean) -> Unit, onDismiss: () -> Unit) {
    var name by remember { mutableStateOf(name0) }
    var desc by remember { mutableStateOf(desc0) }
    var public by remember { mutableStateOf(public0) }
    val c = Kaze.colors
    ModalBottomSheet(onDismiss, containerColor = c.surface, shape = Kaze.style.sheetShape) {
        Column(Modifier.padding(20.dp).padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(title, style = Kaze.type.headline, color = c.text)
            Field("Name", name, { name = it.take(60) })
            Field("Description (optional)", desc, { desc = it.take(280) }, singleLine = false)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Colección pública", style = Kaze.type.body, color = c.text)
                    Text("Visible on your profile when you're signed in", style = Kaze.type.bodySmall, color = c.textMuted)
                }
                Switch(public, { public = it }, colors = SwitchDefaults.colors(checkedTrackColor = c.primary))
            }
            error?.let { Text(it, color = c.error, style = Kaze.type.bodySmall) }
            KazeButton("Guardar", { onSave(name, desc, public) }, enabled = name.isNotBlank(), modifier = Modifier.fillMaxWidth())
        }
    }
}

@Composable
fun Field(label: String, value: String, onChange: (String) -> Unit, singleLine: Boolean = true, modifier: Modifier = Modifier) {
    val c = Kaze.colors
    Column(modifier) {
        Text(label, style = Kaze.type.label, color = c.textMuted)
        Spacer(Modifier.height(4.dp))
        BasicTextField(
            value, onChange, singleLine = singleLine, minLines = if (singleLine) 1 else 3,
            textStyle = Kaze.type.body.copy(color = c.text), cursorBrush = SolidColor(c.primary),
            modifier = Modifier.fillMaxWidth().background(c.surfaceHigh, Kaze.style.chipShape).padding(14.dp).semantics { contentDescription = label },
        )
    }
}

@Composable
fun CollectionDetailScreen(onBack: () -> Unit, onOpenAnime: (Int) -> Unit, vm: CollectionDetailViewModel = hiltViewModel()) {
    val col by vm.collection.collectAsStateWithLifecycle()
    val library by vm.library.collectAsStateWithLifecycle()
    var editing by rememberSaveable { mutableStateOf(false) }
    var adding by rememberSaveable { mutableStateOf(false) }
    val c = Kaze.colors
    val collection = col
    Column(Modifier.fillMaxSize()) {
        KazeTopBar(collection?.name ?: "Colección", onBack, subtitle = collection?.let { "${it.items.size} anime · ${if (it.isPublic) "public" else "private"}" }, actions = {
            KazeIconButton(Icons.Filled.Add, "Add anime from library", { adding = true })
            KazeIconButton(Icons.Filled.Edit, "Editar colección", { editing = true })
        })
        if (collection == null) { Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { KazeSpinner() }; return@Column }
        if (collection.description.isNotBlank()) Text(collection.description, style = Kaze.type.body, color = c.textMuted, modifier = Modifier.padding(horizontal = 20.dp))
        if (collection.items.isEmpty()) EmptyState("Colección vacía", "Add titles from your library or from any anime page.", action = "Add from library", onAction = { adding = true })
        LazyColumn(contentPadding = PaddingValues(bottom = 120.dp)) {
            items(collection.items, key = { it.animeId }) { item ->
                Row(
                    Modifier.fillMaxWidth().animateItem().clickable(role = Role.Button, onClickLabel = "Open ${item.title}") { onOpenAnime(item.animeId) }.padding(horizontal = 16.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("%02d".format(item.position + 1), style = Kaze.type.overline, color = c.primary, modifier = Modifier.width(28.dp))
                    Box(Modifier.width(52.dp).aspectRatio(0.7f).clip(Kaze.style.posterShape)) { AnimeImage(item.coverUrl, null, Modifier.fillMaxSize(), placeholderColor = parseHexColor(item.color)) }
                    Spacer(Modifier.width(12.dp))
                    Text(item.title, style = Kaze.type.titleSmall, color = c.text, modifier = Modifier.weight(1f), maxLines = 2, overflow = TextOverflow.Ellipsis)
                    KazeIconButton(Icons.Filled.KeyboardArrowUp, "Move ${item.title} up", { vm.move(item.animeId, -1) })
                    KazeIconButton(Icons.Filled.KeyboardArrowDown, "Move ${item.title} down", { vm.move(item.animeId, 1) })
                    KazeIconButton(Icons.Filled.Delete, "Quitar ${item.title} de la colección", { vm.remove(item.animeId) }, tint = c.error)
                }
            }
        }
    }
    if (editing && collection != null) CollectionEditor("Editar colección", collection.name, collection.description, collection.isPublic, null, onSave = { n, d, p -> vm.update(n, d, p); editing = false }, onDismiss = { editing = false })
    if (adding && collection != null) {
        val existing = collection.items.map { it.animeId }.toSet()
        ModalBottomSheet({ adding = false }, containerColor = c.surface, shape = Kaze.style.sheetShape) {
            Column(Modifier.verticalScroll(rememberScrollState()).padding(bottom = 24.dp)) {
                Text("Add from your library", style = Kaze.type.title, color = c.text, modifier = Modifier.padding(20.dp))
                val candidates = library.filter { it.animeId !in existing }
                if (candidates.isEmpty()) Text("Everything in your library is already here.", style = Kaze.type.body, color = c.textMuted, modifier = Modifier.padding(horizontal = 20.dp))
                candidates.forEach { e ->
                    Row(Modifier.fillMaxWidth().clickable(role = Role.Button, onClickLabel = "Add ${e.title}") { vm.add(e) }.padding(horizontal = 20.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.width(40.dp).aspectRatio(0.7f).clip(Kaze.style.posterShape)) { AnimeImage(e.coverUrl, null, Modifier.fillMaxSize()) }
                        Spacer(Modifier.width(12.dp))
                        Text(e.title, style = Kaze.type.body, color = c.text, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Icon(Icons.Filled.Add, null, tint = c.primary)
                    }
                }
                KazeButton("Done", { adding = false }, kind = KazeButtonKind.Secondary, modifier = Modifier.padding(20.dp).fillMaxWidth())
            }
        }
    }
}
