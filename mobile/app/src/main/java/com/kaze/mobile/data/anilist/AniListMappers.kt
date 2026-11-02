package com.kaze.mobile.data.anilist

import com.kaze.mobile.domain.model.AiringSlot
import com.kaze.mobile.domain.model.Anime
import com.kaze.mobile.domain.model.AnimeDetail
import com.kaze.mobile.domain.model.AnimeTag
import com.kaze.mobile.domain.model.CharacterRole
import com.kaze.mobile.domain.model.ExternalLink
import com.kaze.mobile.domain.model.Person
import com.kaze.mobile.domain.model.Recommendation
import com.kaze.mobile.domain.model.Relation
import com.kaze.mobile.domain.model.ReviewSummary
import com.kaze.mobile.domain.model.StaffRole
import com.kaze.mobile.domain.model.StreamingEpisode
import com.kaze.mobile.domain.model.Trailer
import com.kaze.mobile.domain.model.prettyEnum

fun MediaDto.toAnime(): Anime = Anime(
    id = id,
    title = title?.romaji ?: title?.english ?: title?.native ?: "Untitled",
    titleEnglish = title?.english,
    titleNative = title?.native,
    coverUrl = coverImage?.extraLarge ?: coverImage?.large,
    bannerUrl = bannerImage,
    color = coverImage?.color,
    score = averageScore,
    popularity = popularity,
    favourites = favourites,
    genres = genres.orEmpty(),
    tags = tags.orEmpty().map { AnimeTag(it.name, it.rank ?: 0, it.isMediaSpoiler == true) },
    format = format,
    status = status,
    episodes = episodes,
    duration = duration,
    season = season,
    seasonYear = seasonYear,
    startYear = startDate?.year,
    description = description,
    studios = studios?.nodes.orEmpty().map { it.name },
    nextEpisode = nextAiringEpisode?.episode,
    nextAiringAt = nextAiringEpisode?.airingAt,
    trailer = trailer?.let { t -> if (t.id != null && t.site != null) Trailer(t.site, t.id) else null },
    isAdult = isAdult == true,
)

private fun FuzzyDateDto?.format(): String? {
    if (this?.year == null) return null
    val months = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
    return buildString {
        if (month != null) append(months[(month - 1).coerceIn(0, 11)]).append(' ')
        if (day != null && month != null) append(day).append(", ")
        append(year)
    }
}

private fun PersonNodeDto.toPerson() = Person(
    id = id,
    name = name?.full ?: "Unknown",
    nativeName = name?.native,
    imageUrl = image?.large ?: image?.medium,
    language = languageV2,
)

fun ReviewDto.toSummary() = ReviewSummary(
    id = id,
    summary = summary.orEmpty(),
    score = score,
    rating = rating,
    ratingAmount = ratingAmount,
    userName = user?.name ?: "AniList user",
    userAvatar = user?.avatar?.medium ?: user?.avatar?.large,
    createdAt = createdAt,
    body = body,
    mediaId = media?.id,
    mediaTitle = media?.title?.english ?: media?.title?.romaji,
    mediaCover = media?.coverImage?.large,
)

fun MediaDto.toDetail(): AnimeDetail = AnimeDetail(
    anime = toAnime(),
    synonyms = synonyms.orEmpty(),
    source = source?.let(::prettyEnum),
    startDate = startDate.format(),
    endDate = endDate.format(),
    meanScore = meanScore,
    siteUrl = siteUrl,
    characters = characters?.edges.orEmpty().mapNotNull { e ->
        val node = e.node ?: return@mapNotNull null
        CharacterRole(
            id = node.id,
            name = node.name?.full ?: "Unknown",
            nativeName = node.name?.native,
            imageUrl = node.image?.large,
            role = prettyEnum(e.role ?: "SUPPORTING"),
            voiceActor = e.voiceActors?.firstOrNull()?.toPerson(),
        )
    },
    staff = staff?.edges.orEmpty().mapNotNull { e -> e.node?.let { StaffRole(it.toPerson(), e.role ?: "Staff") } },
    relations = relations?.edges.orEmpty().mapNotNull { e ->
        val node = e.node ?: return@mapNotNull null
        if (node.type != null && node.type != "ANIME") return@mapNotNull null
        Relation(e.relationType ?: "OTHER", node.toAnime())
    },
    recommendations = recommendations?.nodes.orEmpty().mapNotNull { n ->
        n?.mediaRecommendation?.let { Recommendation(it.toAnime(), n.rating ?: 0) }
    },
    reviews = reviews?.nodes.orEmpty().map { it.toSummary() },
    externalLinks = externalLinks.orEmpty().mapNotNull { l ->
        // Only HTTPS links are ever offered to the user.
        val url = l.url?.takeIf { it.startsWith("https://") } ?: return@mapNotNull null
        ExternalLink(l.site, url, l.type, l.color, l.language)
    },
    streamingEpisodes = streamingEpisodes.orEmpty().mapNotNull { e ->
        val url = e.url?.takeIf { it.startsWith("https://") } ?: return@mapNotNull null
        StreamingEpisode(e.title ?: "Episode", e.thumbnail?.takeIf { it.startsWith("https://") }, url, e.site ?: "Official site")
    },
    rankings = rankings.orEmpty().filter { it.allTime == true || it.year != null }.take(3).map { r ->
        "#${r.rank} ${r.context.replaceFirstChar(Char::titlecase)}${if (r.allTime == true) "" else " ${r.season?.let(::prettyEnum)?.plus(" ") ?: ""}${r.year ?: ""}"}"
    },
    scoreDistribution = stats?.scoreDistribution.orEmpty().map { it.score to it.amount },
)

fun AiringDto.toSlot(): AiringSlot? = media?.let { AiringSlot(it.toAnime(), episode, airingAt) }
