package com.kaze.mobile.core.security

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import dagger.hilt.android.qualifiers.ApplicationContext
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.inject.Inject
import javax.inject.Singleton

/** Abstraction so repositories can be unit tested without the Android Keystore. */
interface TokenStore {
    fun get(key: String): String?
    fun put(key: String, value: String?)
    fun clear(vararg keys: String)
}

/**
 * Secrets (Supabase session, AniList token) are encrypted with an AES-256-GCM key that lives
 * inside the Android Keystore and never leaves it. Only ciphertext + IV reach SharedPreferences,
 * and that file is excluded from backups (see res/xml/backup_rules.xml).
 */
@Singleton
class SecureTokenStore @Inject constructor(@ApplicationContext context: Context) : TokenStore {

    private val prefs = context.getSharedPreferences("kaze_secure_store", Context.MODE_PRIVATE)

    /**
     * Loaded lazily; if the platform keystore is unavailable or broken we fail closed:
     * secrets are simply not persisted (the user signs in again) — never stored in plaintext.
     */
    private val keyStore: KeyStore? by lazy {
        runCatching { KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) } }.getOrNull()
    }

    val isAvailable: Boolean get() = keyStore != null

    private fun secretKey(): SecretKey {
        val keyStore = keyStore ?: throw IllegalStateException("Android Keystore unavailable")
        (keyStore.getEntry(ALIAS, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        generator.init(
            KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        )
        return generator.generateKey()
    }

    @Synchronized
    override fun get(key: String): String? {
        if (!isAvailable) return null
        val stored = prefs.getString(key, null) ?: return null
        return runCatching {
            val (ivB64, dataB64) = stored.split(':', limit = 2)
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(128, Base64.decode(ivB64, Base64.NO_WRAP)))
            String(cipher.doFinal(Base64.decode(dataB64, Base64.NO_WRAP)), Charsets.UTF_8)
        }.getOrElse {
            // Key invalidated (e.g. restored to a new device): drop the unreadable secret.
            prefs.edit().remove(key).apply()
            null
        }
    }

    @Synchronized
    override fun put(key: String, value: String?) {
        if (value == null || !isAvailable) { prefs.edit().remove(key).apply(); return }
        runCatching {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, secretKey())
            val data = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
            Base64.encodeToString(cipher.iv, Base64.NO_WRAP) + ":" + Base64.encodeToString(data, Base64.NO_WRAP)
        }.onSuccess { prefs.edit().putString(key, it).apply() }
            .onFailure { prefs.edit().remove(key).apply() }
    }

    @Synchronized
    override fun clear(vararg keys: String) {
        prefs.edit().apply { keys.forEach { remove(it) } }.apply()
    }

    private companion object {
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val ALIAS = "kaze_token_key_v1"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
    }
}
