package com.kaze.mobile.data.backend

import android.net.Uri
import com.kaze.mobile.CallbackHandler
import com.kaze.mobile.core.common.KazeError
import com.kaze.mobile.core.common.KazeException
import com.kaze.mobile.core.common.Outcome
import com.kaze.mobile.core.common.outcomeOf
import com.kaze.mobile.core.di.ApplicationScope
import com.kaze.mobile.domain.social.EmailRules
import com.kaze.mobile.domain.social.PasswordRules
import com.kaze.mobile.domain.social.UsernameRules
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import dagger.multibindings.IntoSet
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

sealed interface AuthEvent {
    data object EmailVerified : AuthEvent
    data object PasswordRecovery : AuthEvent
    data class Failed(val message: String) : AuthEvent
}

@Singleton
class AuthRepository @Inject constructor(
    private val sb: SupabaseClient,
    private val social: SocialRepository,
    @ApplicationScope private val scope: CoroutineScope,
) : CallbackHandler {

    val state = sb.auth
    val isConfigured get() = sb.config.isConfigured

    private val _events = Channel<AuthEvent>(Channel.BUFFERED)
    val events = _events.receiveAsFlow()

    suspend fun signIn(email: String, password: String): Outcome<Unit> = outcomeOf {
        if (!EmailRules.isValid(email)) throw KazeException(KazeError.Validation("Enter a valid email address."))
        if (password.isEmpty()) throw KazeException(KazeError.Validation("Enter your password."))
        sb.signIn(email.trim(), password)
        social.loadMyProfile()
        Unit
    }

    /** @return true if signed in immediately, false if the user must confirm their email first. */
    suspend fun register(email: String, password: String, username: String): Outcome<Boolean> = outcomeOf {
        if (!EmailRules.isValid(email)) throw KazeException(KazeError.Validation("Enter a valid email address."))
        if (!UsernameRules.isValid(username)) throw KazeException(KazeError.Validation("Username must be ${UsernameRules.HINT}."))
        PasswordRules.problems(password).takeIf { it.isNotEmpty() }?.let { throw KazeException(KazeError.Validation("Password needs " + it.joinToString(", ") + ".")) }
        sb.signUp(email.trim(), password, username)
    }

    suspend fun sendReset(email: String) = outcomeOf {
        if (!EmailRules.isValid(email)) throw KazeException(KazeError.Validation("Enter a valid email address."))
        sb.sendPasswordReset(email.trim())
    }

    suspend fun resendVerification(email: String) = outcomeOf { sb.resendVerification(email) }

    suspend fun setNewPassword(password: String) = outcomeOf {
        PasswordRules.problems(password).takeIf { it.isNotEmpty() }?.let { throw KazeException(KazeError.Validation("Password needs " + it.joinToString(", ") + ".")) }
        sb.updatePassword(password)
    }

    suspend fun refresh() = outcomeOf { sb.refreshUser() }

    suspend fun signOut() { sb.signOut(); social.clearCache() }

    // ---------------------------------------------------------------- kaze://auth-callback
    override val host = "auth-callback"

    override fun handle(uri: Uri): Boolean {
        val fragment = uri.fragment?.let { Uri.parse("x://x?$it") }
        val error = uri.getQueryParameter("error_description") ?: fragment?.getQueryParameter("error_description")
        if (error != null) { scope.launch { _events.send(AuthEvent.Failed(error)) }; return true }
        val code = uri.getQueryParameter("code")
        val type = uri.getQueryParameter("type") ?: fragment?.getQueryParameter("type")
        scope.launch {
            val result = outcomeOf {
                val purpose = when {
                    code != null && code.length in 8..512 -> sb.exchangeCode(code)
                    fragment?.getQueryParameter("access_token") != null -> {
                        sb.acceptFragmentSession(
                            fragment.getQueryParameter("access_token")!!,
                            fragment.getQueryParameter("refresh_token") ?: throw KazeException(KazeError.Validation("Incomplete sign-in link.")),
                            fragment.getQueryParameter("expires_in")?.toLongOrNull() ?: 3600,
                        )
                        type ?: "signup"
                    }
                    else -> throw KazeException(KazeError.Validation("This link is invalid or has expired."))
                }
                social.loadMyProfile()
                purpose
            }
            when (result) {
                is Outcome.Success -> _events.send(if (result.value == "recovery" || type == "recovery") AuthEvent.PasswordRecovery else AuthEvent.EmailVerified)
                is Outcome.Failure -> _events.send(AuthEvent.Failed(result.error.userMessage))
            }
        }
        return true
    }
}

@Module
@InstallIn(SingletonComponent::class)
abstract class AuthCallbackModule {
    @Binds @IntoSet abstract fun supabaseCallback(impl: AuthRepository): CallbackHandler
    @Binds @IntoSet abstract fun anilistCallback(impl: AniListAuthRepository): CallbackHandler
}
