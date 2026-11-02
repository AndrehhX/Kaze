package com.kaze.mobile.core.di

import android.content.Context
import androidx.room.Room
import com.kaze.mobile.BuildConfig
import com.kaze.mobile.core.database.KazeDatabase
import com.kaze.mobile.core.network.RetryInterceptor
import com.kaze.mobile.core.network.UserAgentInterceptor
import com.kaze.mobile.core.security.SecureTokenStore
import com.kaze.mobile.core.security.TokenStore
import com.kaze.mobile.data.anilist.Clock
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import kotlinx.serialization.json.Json
import okhttp3.Cache
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import java.io.File
import java.util.concurrent.TimeUnit
import javax.inject.Named
import javax.inject.Qualifier
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import com.kaze.mobile.data.playback.DemoMediaProvider
import com.kaze.mobile.data.playback.OruneiMediaProvider
import com.kaze.mobile.domain.playback.MediaProvider
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides @Singleton
    fun json(): Json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        coerceInputValues = true
        encodeDefaults = true
    }

    @Provides @Singleton
    fun okHttp(@ApplicationContext context: Context): OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .callTimeout(60, TimeUnit.SECONDS)
        .cache(Cache(File(context.cacheDir, "http"), 20L * 1024 * 1024))
        .addInterceptor(UserAgentInterceptor("KAZE-Mobile/${BuildConfig.VERSION_NAME} (Android; okhttp)"))
        .addInterceptor(RetryInterceptor())
        .apply {
            if (BuildConfig.DEBUG) addInterceptor(HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BASIC
                redactHeader("Authorization")
                redactHeader("apikey")
            })
        }
        .build()

    @Provides @Named("anilistEndpoint")
    fun anilistEndpoint(): String = "https://graphql.anilist.co"

    @Provides @Singleton
    fun database(@ApplicationContext context: Context): KazeDatabase =
        Room.databaseBuilder(context, KazeDatabase::class.java, "kaze.db").build()

    @Provides fun cacheDao(db: KazeDatabase) = db.cacheDao()
    @Provides fun libraryDao(db: KazeDatabase) = db.libraryDao()
    @Provides fun collectionDao(db: KazeDatabase) = db.collectionDao()
    @Provides fun playbackDao(db: KazeDatabase) = db.playbackDao()
    @Provides fun activityDao(db: KazeDatabase) = db.activityDao()

    @Provides @Singleton
    fun clock(): Clock = Clock { System.currentTimeMillis() }

    /** Outlives screens: used for writes that must finish even as a ViewModel is cleared. */
    @Provides @Singleton @ApplicationScope
    fun appScope(): CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
}

@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class ApplicationScope

@Module
@InstallIn(SingletonComponent::class)
abstract class BindingsModule {
    @Binds abstract fun tokenStore(impl: SecureTokenStore): TokenStore
    @Binds abstract fun mediaProvider(impl: OruneiMediaProvider): MediaProvider
}
