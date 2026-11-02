package com.kaze.mobile.feature.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.kaze.mobile.core.common.Outcome
import com.kaze.mobile.core.designsystem.components.KazeButton
import com.kaze.mobile.core.designsystem.components.KazeButtonKind
import com.kaze.mobile.core.designsystem.components.KazeCard
import com.kaze.mobile.core.designsystem.components.KazeIconButton
import com.kaze.mobile.core.designsystem.components.KazeTopBar
import com.kaze.mobile.core.designsystem.theme.Kaze
import com.kaze.mobile.data.backend.AuthRepository
import com.kaze.mobile.data.backend.AuthState
import com.kaze.mobile.data.backend.SocialRepository
import com.kaze.mobile.domain.social.PasswordRules
import com.kaze.mobile.domain.social.UsernameRules
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class FormState(val busy: Boolean = false, val error: String? = null, val info: String? = null, val done: Boolean = false)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val auth: AuthRepository,
    private val social: SocialRepository,
) : ViewModel() {
    val state = auth.state
    val isConfigured = auth.isConfigured
    private val _form = MutableStateFlow(FormState())
    val form = _form.asStateFlow()

    private fun run(block: suspend () -> Outcome<*>, onOk: (Any?) -> FormState) = viewModelScope.launch {
        _form.value = FormState(busy = true)
        _form.value = when (val r = block()) {
            is Outcome.Success -> onOk(r.value)
            is Outcome.Failure -> FormState(error = r.error.userMessage)
        }
    }

    fun signIn(email: String, password: String) = run({ auth.signIn(email, password) }) { FormState(done = true) }
    fun register(email: String, password: String, username: String) = run({ auth.register(email, password, username) }) { signedIn ->
        if (signedIn == true) FormState(done = true)
        else FormState(info = "Check $email for a confirmation link. Open it on this phone to finish signing in.")
    }
    fun reset(email: String) = run({ auth.sendReset(email) }) { FormState(info = "If an account exists for $email, a reset link is on its way. Open it on this phone.") }
    fun resend(email: String) = run({ auth.resendVerification(email) }) { FormState(info = "Verification email sent again.") }
    fun newPassword(p: String) = run({ auth.setNewPassword(p) }) { FormState(done = true, info = "Password updated.") }
    fun refresh() = run({ auth.refresh() }) { FormState() }
    fun signOut() = viewModelScope.launch { auth.signOut() }
    fun deleteAccount() = run({ social.deleteAccount() }) { FormState(done = true, info = "Your account and all its data were deleted.") }
    fun clear() { _form.value = FormState() }
}

@Composable
fun BackendNotConfiguredCard(modifier: Modifier = Modifier) {
    val c = Kaze.colors
    KazeCard(modifier.fillMaxWidth()) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("KAZE accounts aren't configured in this build", style = Kaze.type.title, color = c.text)
            Text(
                "Accounts, friends, community posts and online watch parties need a Supabase project. Add SUPABASE_URL and SUPABASE_ANON_KEY to local.properties and rebuild (see docs/BACKEND.md). Everything else works in guest mode.",
                style = Kaze.type.bodySmall, color = c.textMuted,
            )
        }
    }
}

@Composable
fun AuthField(label: String, value: String, onChange: (String) -> Unit, password: Boolean = false, keyboard: KeyboardType = KeyboardType.Text, hint: String? = null) {
    val c = Kaze.colors
    var visible by rememberSaveable { mutableStateOf(false) }
    Column {
        Text(label, style = Kaze.type.label, color = c.textMuted)
        Spacer(Modifier.height(4.dp))
        Row(Modifier.fillMaxWidth().background(c.surfaceHigh, Kaze.style.chipShape).padding(start = 14.dp), verticalAlignment = Alignment.CenterVertically) {
            BasicTextField(
                value, onChange, singleLine = true,
                textStyle = Kaze.type.body.copy(color = c.text), cursorBrush = SolidColor(c.primary),
                visualTransformation = if (password && !visible) PasswordVisualTransformation() else VisualTransformation.None,
                keyboardOptions = KeyboardOptions(keyboardType = if (password) KeyboardType.Password else keyboard, imeAction = ImeAction.Next, autoCorrectEnabled = false),
                modifier = Modifier.weight(1f).padding(vertical = 14.dp).semantics { contentDescription = label },
            )
            if (password) KazeIconButton(if (visible) Icons.Filled.VisibilityOff else Icons.Filled.Visibility, if (visible) "Ocultar contraseña" else "Mostrar contraseña", { visible = !visible }, tint = c.textMuted)
        }
        if (hint != null) Text(hint, style = Kaze.type.bodySmall, color = c.textMuted)
    }
}

@Composable
private fun FormMessages(form: FormState) {
    form.error?.let { Text(it, color = Kaze.colors.error, style = Kaze.type.bodySmall, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Assertive }) }
    form.info?.let { Text(it, color = Kaze.colors.success, style = Kaze.type.bodySmall, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }) }
}

@Composable
fun LoginScreen(onBack: () -> Unit, onRegister: () -> Unit, onForgot: () -> Unit, onDone: () -> Unit, vm: AuthViewModel = hiltViewModel()) {
    val form by vm.form.collectAsStateWithLifecycle()
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    if (form.done) { vm.clear(); onDone() }
    Column(Modifier.fillMaxSize().imePadding().verticalScroll(rememberScrollState())) {
        KazeTopBar("Iniciar sesión", onBack)
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text("Bienvenido de nuevo", style = Kaze.type.display, color = Kaze.colors.text)
            if (!vm.isConfigured) BackendNotConfiguredCard()
            AuthField("Correo electrónico", email, { email = it.take(254) }, keyboard = KeyboardType.Email)
            AuthField("Contraseña", password, { password = it.take(128) }, password = true)
            FormMessages(form)
            KazeButton("Iniciar sesión", { vm.signIn(email, password) }, loading = form.busy, enabled = vm.isConfigured, modifier = Modifier.fillMaxWidth())
            KazeButton("¿Olvidaste tu contraseña?", onForgot, kind = KazeButtonKind.Ghost, enabled = vm.isConfigured)
            KazeButton("Crear una cuenta", onRegister, kind = KazeButtonKind.Secondary, enabled = vm.isConfigured, modifier = Modifier.fillMaxWidth())
            Text("Guest mode keeps working without an account: browsing, demo playback, your local library and themes.", style = Kaze.type.bodySmall, color = Kaze.colors.textMuted)
        }
    }
}

@Composable
fun RegisterScreen(onBack: () -> Unit, onDone: () -> Unit, vm: AuthViewModel = hiltViewModel()) {
    val form by vm.form.collectAsStateWithLifecycle()
    var email by rememberSaveable { mutableStateOf("") }
    var username by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    if (form.done) { vm.clear(); onDone() }
    val pwProblems = PasswordRules.problems(password)
    Column(Modifier.fillMaxSize().imePadding().verticalScroll(rememberScrollState())) {
        KazeTopBar("Crear cuenta", onBack)
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            if (!vm.isConfigured) BackendNotConfiguredCard()
            AuthField("Username", username, { username = it.take(24) }, hint = UsernameRules.HINT)
            AuthField("Correo electrónico", email, { email = it.take(254) }, keyboard = KeyboardType.Email)
            AuthField("Contraseña", password, { password = it.take(128) }, password = true, hint = if (password.isEmpty()) "At least 10 characters with letters and numbers" else if (pwProblems.isEmpty()) "Strong enough ✓" else "Needs " + pwProblems.joinToString(", "))
            FormMessages(form)
            KazeButton("Crear cuenta", { vm.register(email, password, username) }, loading = form.busy, enabled = vm.isConfigured && form.info == null, modifier = Modifier.fillMaxWidth())
            if (form.info != null) KazeButton("Resend email", { vm.resend(email) }, kind = KazeButtonKind.Ghost)
            Text("We'll email you a confirmation link. Your local library stays on this device until you choose to sync it.", style = Kaze.type.bodySmall, color = Kaze.colors.textMuted)
        }
    }
}

@Composable
fun PasswordRecoveryScreen(onBack: () -> Unit, vm: AuthViewModel = hiltViewModel()) {
    val form by vm.form.collectAsStateWithLifecycle()
    var email by rememberSaveable { mutableStateOf("") }
    Column(Modifier.fillMaxSize().imePadding()) {
        KazeTopBar("Reset password", onBack)
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            if (!vm.isConfigured) BackendNotConfiguredCard()
            Text("Enter your account email. We'll send a secure, single-use link that opens KAZE to choose a new password.", style = Kaze.type.body, color = Kaze.colors.textMuted)
            AuthField("Correo electrónico", email, { email = it.take(254) }, keyboard = KeyboardType.Email)
            FormMessages(form)
            KazeButton("Send reset link", { vm.reset(email) }, loading = form.busy, enabled = vm.isConfigured, modifier = Modifier.fillMaxWidth())
        }
    }
}

@Composable
fun NewPasswordScreen(onDone: () -> Unit, vm: AuthViewModel = hiltViewModel()) {
    val form by vm.form.collectAsStateWithLifecycle()
    var password by rememberSaveable { mutableStateOf("") }
    if (form.done) { vm.clear(); onDone() }
    Column(Modifier.fillMaxSize().imePadding()) {
        KazeTopBar("Choose a new password", onDone)
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            AuthField("New password", password, { password = it.take(128) }, password = true, hint = PasswordRules.problems(password).let { if (it.isEmpty()) "Strong enough ✓" else "Needs " + it.joinToString(", ") })
            FormMessages(form)
            KazeButton("Update password", { vm.newPassword(password) }, loading = form.busy, modifier = Modifier.fillMaxWidth())
        }
    }
}

@Composable
fun AccountScreen(onBack: () -> Unit, onLogin: () -> Unit, onSignedOut: () -> Unit, vm: AuthViewModel = hiltViewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    val form by vm.form.collectAsStateWithLifecycle()
    var confirmDelete by rememberSaveable { mutableStateOf(false) }
    var typed by rememberSaveable { mutableStateOf("") }
    val c = Kaze.colors
    if (form.done) { vm.clear(); onSignedOut() }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        KazeTopBar("Account", onBack)
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            when (val s = state) {
                AuthState.NotConfigured -> BackendNotConfiguredCard()
                AuthState.SignedOut -> {
                    Text("You're using KAZE as a guest.", style = Kaze.type.title, color = c.text)
                    KazeButton("Iniciar sesión o crear cuenta", onLogin, modifier = Modifier.fillMaxWidth())
                }
                is AuthState.SignedIn -> {
                    KazeCard(Modifier.fillMaxWidth()) {
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(s.user.email ?: "Signed in", style = Kaze.type.title, color = c.text)
                            Text(if (s.emailVerified) "Email verified ✓" else "Email not verified yet", style = Kaze.type.bodySmall, color = if (s.emailVerified) c.success else c.warning)
                            Text("Session stored encrypted with the Android Keystore.", style = Kaze.type.bodySmall, color = c.textMuted)
                        }
                    }
                    if (!s.emailVerified) {
                        KazeButton("Resend verification email", { s.user.email?.let(vm::resend) }, kind = KazeButtonKind.Secondary)
                        KazeButton("I've verified — refresh", vm::refresh, kind = KazeButtonKind.Ghost)
                    }
                    FormMessages(form)
                    KazeButton("Sign out", { vm.signOut(); onSignedOut() }, kind = KazeButtonKind.Secondary, modifier = Modifier.fillMaxWidth())
                    Spacer(Modifier.height(24.dp))
                    Text("Danger zone", style = Kaze.type.title, color = c.error)
                    Text("Eliminar tu cuenta borrará permanentemente tu perfil, amigos, reseñas, debates, biblioteca en la nube y salas compartidas del servidor. Tu biblioteca en este dispositivo se mantendrá salvo que decidas limpiarla.", style = Kaze.type.bodySmall, color = c.textMuted)
                    KazeButton("Eliminar cuenta", { confirmDelete = true }, kind = KazeButtonKind.Ghost)
                }
            }
        }
    }
    if (confirmDelete) AlertDialog(
        onDismissRequest = { confirmDelete = false },
        title = { Text("¿Eliminar tu cuenta de KAZE?") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Esta acción no se puede deshacer. Escribe ELIMINAR para confirmar.")
                AuthField("Confirmation", typed, { typed = it.take(10) })
            }
        },
        confirmButton = { TextButton({ vm.deleteAccount(); confirmDelete = false }, enabled = typed == "ELIMINAR") { Text("Delete forever", color = c.error) } },
        dismissButton = { TextButton({ confirmDelete = false }) { Text("Cancel") } },
        containerColor = c.surface,
    )
}
