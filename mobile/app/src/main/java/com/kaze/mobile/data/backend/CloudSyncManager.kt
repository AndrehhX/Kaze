package com.kaze.mobile.data.backend

import android.util.Log
import com.kaze.mobile.core.common.Outcome
import com.kaze.mobile.core.di.ApplicationScope
import com.kaze.mobile.data.library.LibraryRepository
import com.kaze.mobile.data.library.ProgressRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.merge
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Mantiene la app y la web con los mismos datos sin que el usuario tenga que hacer nada:
 * sincroniza al abrir la app, al iniciar sesión, unos segundos después de cada cambio
 * en la biblioteca o el progreso, y cada 2 minutos mientras la app está abierta.
 */
@Singleton
class CloudSyncManager @Inject constructor(
    private val sb: SupabaseClient,
    private val cloud: CloudLibraryRepository,
    private val library: LibraryRepository,
    private val progress: ProgressRepository,
    @ApplicationScope private val scope: CoroutineScope,
) {
    private val _lastResult = MutableStateFlow<CloudLibraryRepository.SyncResult?>(null)
    val lastResult: StateFlow<CloudLibraryRepository.SyncResult?> = _lastResult.asStateFlow()

    private var session: Job? = null
    private var started = false

    @OptIn(FlowPreview::class)
    fun start() {
        if (started) return
        started = true
        scope.launch {
            sb.auth.map { it as? AuthState.SignedIn }.map { it?.user?.id }.distinctUntilChanged().collect { userId ->
                session?.cancel()
                if (userId == null) return@collect
                session = scope.launch {
                    syncNow()
                    // Cambios locales: se suben a los pocos segundos.
                    launch {
                        merge(library.entries.drop(1).map { }, progress.history.drop(1).map { })
                            .debounce(4_000)
                            .collect { syncNow() }
                    }
                    // Cambios hechos en la web: se bajan periódicamente.
                    while (isActive) {
                        delay(120_000)
                        syncNow()
                    }
                }
            }
        }
    }

    suspend fun syncNow() {
        when (val r = cloud.syncAll()) {
            is Outcome.Success -> _lastResult.value = r.value
            is Outcome.Failure -> Log.w("KazeSync", "Sincronización fallida: ${r.error}")
        }
    }
}
