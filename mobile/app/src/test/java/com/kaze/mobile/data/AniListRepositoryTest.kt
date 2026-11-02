package com.kaze.mobile.data

import app.cash.turbine.test
import com.kaze.mobile.core.common.KazeError
import com.kaze.mobile.core.common.Outcome
import com.kaze.mobile.core.database.CacheDao
import com.kaze.mobile.core.database.CachedQueryEntity
import com.kaze.mobile.core.network.RetryInterceptor
import com.kaze.mobile.data.anilist.AniListClient
import com.kaze.mobile.data.anilist.AniListRepository
import com.kaze.mobile.data.anilist.Clock
import com.kaze.mobile.domain.model.SearchFilters
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class FakeCacheDao : CacheDao {
    val rows = mutableMapOf<String, CachedQueryEntity>()
    override suspend fun get(key: String) = rows[key]
    override suspend fun put(entity: CachedQueryEntity) { rows[entity.key] = entity }
    override suspend fun trim(prefix: String, keep: Int) {
        val matching = rows.values.filter { it.key.startsWith(prefix) }.sortedByDescending { it.fetchedAt }
        matching.drop(keep).forEach { rows.remove(it.key) }
    }
    override suspend fun clear() = rows.clear()
}

class AniListRepositoryTest {
    private lateinit var server: MockWebServer
    private lateinit var repo: AniListRepository
    private val cache = FakeCacheDao()
    private var now = 1_000_000L
    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false; coerceInputValues = true }

    @Before fun setUp() {
        server = MockWebServer().apply { start() }
        val http = OkHttpClient.Builder().addInterceptor(RetryInterceptor(maxRetries = 2, sleeper = {})).build()
        val client = AniListClient(http, json, server.url("/").toString())
        repo = AniListRepository(client, cache, Clock { now })
    }

    @After fun tearDown() = server.shutdown()

    private fun media(id: Int, title: String, score: Int = 80, adult: Boolean = false) = """
        {"id":$id,"title":{"romaji":"$title","english":"$title EN","native":"ネイティブ"},
         "coverImage":{"extraLarge":"https://img/$id.jpg","color":"#aabbcc"},"bannerImage":null,
         "averageScore":$score,"popularity":1000,"favourites":10,"genres":["Action","Drama"],
         "tags":[{"name":"Time Travel","rank":90,"isMediaSpoiler":false},{"name":"Twist","rank":80,"isMediaSpoiler":true}],
         "format":"TV","status":"FINISHED","episodes":12,"duration":24,"season":"FALL","seasonYear":2023,
         "startDate":{"year":2023,"month":10,"day":1},"description":"<b>Bold</b> story<br>line",
         "isAdult":$adult,"studios":{"nodes":[{"name":"Madhouse"}]},"nextAiringEpisode":null,"trailer":{"id":"abc","site":"youtube"}}
    """.trimIndent()

    private fun searchBody(vararg items: String, hasNext: Boolean = true) =
        """{"data":{"Page":{"pageInfo":{"currentPage":1,"hasNextPage":$hasNext},"media":[${items.joinToString(",")}]}}}"""

    @Test fun search_parsesTypedModels_andFiltersAdultTitles() = runTest {
        server.enqueue(MockResponse().setBody(searchBody(media(1, "Frieren"), media(2, "Hidden", adult = true))))
        val r = repo.search(SearchFilters(query = "frieren"), page = 1)
        assertTrue(r is Outcome.Success)
        val page = (r as Outcome.Success).value
        assertEquals(1, page.items.size)
        val a = page.items.first()
        assertEquals("Frieren EN", a.displayTitle)
        assertEquals(listOf("Madhouse"), a.studios)
        assertEquals("https://www.youtube.com/watch?v=abc", a.trailer?.url)
        assertTrue(a.tags.any { it.isSpoiler })
        assertTrue(page.hasNextPage)
        val sent = server.takeRequest().body.readUtf8()
        assertTrue("search uses SEARCH_MATCH sort for text queries", sent.contains("SEARCH_MATCH"))
        // Regression: explicit nulls make AniList return zero results / HTTP 400, so unset filters are omitted.
        val vars = Json.parseToJsonElement(sent).let { (it as kotlinx.serialization.json.JsonObject)["variables"] as kotlinx.serialization.json.JsonObject }
        assertFalse(vars.containsKey("minScore") || vars.containsKey("season") || vars.containsKey("format") || vars.containsKey("status"))
    }

    @Test fun search_fallsBackToCache_whenOffline() = runTest {
        server.enqueue(MockResponse().setBody(searchBody(media(1, "Frieren"))))
        repo.search(SearchFilters(query = "frieren"), 1)
        server.shutdown() // network gone
        val r = repo.search(SearchFilters(query = "frieren"), 1)
        assertTrue("cached page should be served offline", r is Outcome.Success)
    }

    @Test fun retriesOn429_thenSucceeds() = runTest {
        server.enqueue(MockResponse().setResponseCode(429).setHeader("Retry-After", "1").setBody("""{"errors":[{"message":"Too Many Requests","status":429}],"data":null}"""))
        server.enqueue(MockResponse().setBody(searchBody(media(3, "Mushishi"))))
        val r = repo.search(SearchFilters(query = "mushi"), 1)
        assertTrue(r is Outcome.Success)
        assertEquals(2, server.requestCount)
    }

    @Test fun graphQlNotFound_mapsToNotFound() = runTest {
        server.enqueue(MockResponse().setResponseCode(404).setBody("""{"errors":[{"message":"Not Found.","status":404}],"data":{"Media":null}}"""))
        val r = repo.graph(999999)
        assertTrue(r is Outcome.Failure)
        assertTrue((r as Outcome.Failure).error is KazeError.NotFound)
    }

    @Test fun detail_emitsCacheThenNetwork() = runTest {
        val body = """{"data":{"Media":${media(5, "Mononoke").dropLast(1)},"characters":{"edges":[{"role":"MAIN","node":{"id":9,"name":{"full":"Medicine Seller"},"image":{"large":"https://c/9.jpg"}},"voiceActors":[{"id":4,"name":{"full":"Takahiro Sakurai"},"image":{"large":"https://v/4.jpg"},"languageV2":"Japanese"}]}]},"externalLinks":[{"site":"Crunchyroll","url":"https://crunchyroll.com/x","type":"STREAMING"},{"site":"Bad","url":"http://insecure","type":"STREAMING"}],"relations":{"edges":[]},"recommendations":{"nodes":[]},"reviews":{"nodes":[]}}}}"""
        server.enqueue(MockResponse().setBody(body))
        repo.detail(5).test {
            assertTrue(awaitItem().loading)
            val loaded = awaitItem()
            val d = loaded.data!!
            assertEquals("Medicine Seller", d.characters.first().name)
            assertEquals("Takahiro Sakurai", d.characters.first().voiceActor?.name)
            assertEquals("only https streaming links survive", 1, d.streamingLinks.size)
            awaitComplete()
        }
        // Second subscription within TTL: served from cache without a network call.
        repo.detail(5).test {
            val cached = awaitItem()
            assertNotNull(cached.data)
            assertTrue(cached.stale)
            assertFalse(cached.loading)
            awaitComplete()
        }
        assertEquals(1, server.requestCount)
    }

    @Test fun searchCache_isBounded() = runTest {
        repeat(70) { i ->
            now += 1
            server.enqueue(MockResponse().setBody(searchBody(media(i + 10, "T$i"))))
            repo.search(SearchFilters(query = "q$i"), 1)
        }
        assertTrue(cache.rows.keys.count { it.startsWith("search:") } <= 60)
    }
}
