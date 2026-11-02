package com.kaze.mobile

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.kaze.mobile.core.security.SecureTokenStore
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Runs on a real device/emulator: Robolectric has no AndroidKeyStore, so this is the only
 * place the encryption path is exercised end to end.
 */
@RunWith(AndroidJUnit4::class)
class SecureTokenStoreDeviceTest {

    private val context: Context = ApplicationProvider.getApplicationContext()
    private val key = "device_test_session"
    private val secret = "eyJhbGciOiJIUzI1NiJ9.device-test-session-token"

    @After fun cleanUp() = SecureTokenStore(context).clear(key)

    @Test fun keystoreIsAvailable_andSecretRoundTrips() {
        val store = SecureTokenStore(context)
        assertTrue("Android Keystore should exist on a real device", store.isAvailable)
        store.put(key, secret)
        assertEquals(secret, store.get(key))
    }

    @Test fun onlyCiphertextReachesDisk() {
        SecureTokenStore(context).put(key, secret)
        val raw = context.getSharedPreferences("kaze_secure_store", Context.MODE_PRIVATE).getString(key, null)
        assertNotNull(raw)
        assertFalse("plaintext must never be stored", raw!!.contains("device-test-session-token"))
        assertTrue("stored as iv:ciphertext", raw.contains(':'))
    }

    @Test fun secretSurvivesANewStoreInstance_andClearRemovesIt() {
        SecureTokenStore(context).put(key, secret)
        val reopened = SecureTokenStore(context)
        assertEquals(secret, reopened.get(key))
        reopened.clear(key)
        assertNull(SecureTokenStore(context).get(key))
    }

    @Test fun tamperedCiphertextIsDroppedInsteadOfCrashing() {
        SecureTokenStore(context).put(key, secret)
        val prefs = context.getSharedPreferences("kaze_secure_store", Context.MODE_PRIVATE)
        val (iv, data) = prefs.getString(key, null)!!.split(':', limit = 2)
        val flipped = data.replaceRange(0, 1, if (data[0] == 'A') "B" else "A")
        prefs.edit().putString(key, "$iv:$flipped").commit()
        assertNull(SecureTokenStore(context).get(key))
        assertNull(prefs.getString(key, null))
    }
}
