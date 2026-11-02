package com.kaze.mobile

import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.navigation.NavHostController
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import dagger.multibindings.Multibinds
import javax.inject.Inject
import javax.inject.Singleton

/** A component that owns one OAuth / email-link callback host (e.g. "auth-callback"). */
interface CallbackHandler {
    val host: String
    /** Returns true when the URI was recognised and consumed. Must validate before acting. */
    fun handle(uri: Uri): Boolean
}

/**
 * Routes incoming intents. Callback URIs (tokens in the fragment) never reach the navigation
 * graph; content links (kaze://anime/ID …) are handed to Navigation's typed deep-link matcher.
 */
@Singleton
class DeepLinkRouter @Inject constructor(
    private val handlers: Set<@JvmSuppressWildcards CallbackHandler>,
) {
    private var nav: NavHostController? = null
    private var pending: Intent? = null

    fun handleAuthCallback(intent: Intent?): Boolean {
        val uri = intent?.data ?: return false
        if (uri.scheme != "kaze") return false
        val handler = handlers.firstOrNull { it.host == uri.host } ?: return false
        handler.handle(uri)
        // Strip the secret-bearing URI so it can't be replayed from recents / config changes.
        intent.data = null
        return true
    }

    fun dispatch(intent: Intent) {
        val uri = intent.data ?: return
        if (!isSafeContentLink(uri)) return
        val n = nav
        if (n == null) pending = intent else n.handleDeepLink(intent)
    }

    @Composable
    fun Bind(nav: NavHostController) {
        DisposableEffect(nav) {
            this@DeepLinkRouter.nav = nav
            pending?.let { nav.handleDeepLink(it); pending = null }
            onDispose { if (this@DeepLinkRouter.nav === nav) this@DeepLinkRouter.nav = null }
        }
    }

    companion object {
        private val allowedHosts = setOf("anime", "party", "user", "notifications")

        /** Only our scheme, known hosts, and short alphanumeric path segments are accepted. */
        fun isSafeContentLink(uri: Uri): Boolean {
            if (uri.scheme != "kaze" || uri.host !in allowedHosts) return false
            return uri.pathSegments.all { it.length in 1..64 && it.all { ch -> ch.isLetterOrDigit() || ch == '-' || ch == '_' } }
        }
    }
}

@Module
@InstallIn(SingletonComponent::class)
abstract class CallbackHandlersModule {
    @Multibinds abstract fun callbackHandlers(): Set<CallbackHandler>
}
