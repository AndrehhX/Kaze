package com.kaze.mobile.data.anilist

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

@Serializable
data class GraphQlRequest(val query: String, val variables: JsonObject = JsonObject(emptyMap()))

@Serializable
data class GraphQlResponse<T>(val data: T? = null, val errors: List<GraphQlError>? = null)

@Serializable
data class GraphQlError(val message: String, val status: Int? = null)

@Serializable data class TitleDto(val romaji: String? = null, val english: String? = null, val native: String? = null)
@Serializable data class CoverDto(val extraLarge: String? = null, val large: String? = null, val medium: String? = null, val color: String? = null)
@Serializable data class FuzzyDateDto(val year: Int? = null, val month: Int? = null, val day: Int? = null)
@Serializable data class TagDto(val name: String, val rank: Int? = null, val isMediaSpoiler: Boolean? = null)
@Serializable data class NameNodesDto(val nodes: List<NameDto> = emptyList())
@Serializable data class NameDto(val name: String)
@Serializable data class NextAiringDto(val episode: Int, val airingAt: Long)
@Serializable data class TrailerDto(val id: String? = null, val site: String? = null)

@Serializable
data class MediaDto(
    val id: Int,
    val idMal: Int? = null,
    val type: String? = null,
    val title: TitleDto? = null,
    val coverImage: CoverDto? = null,
    val bannerImage: String? = null,
    val averageScore: Int? = null,
    val meanScore: Int? = null,
    val popularity: Int? = null,
    val favourites: Int? = null,
    val genres: List<String>? = null,
    val tags: List<TagDto>? = null,
    val format: String? = null,
    val status: String? = null,
    val episodes: Int? = null,
    val duration: Int? = null,
    val season: String? = null,
    val seasonYear: Int? = null,
    val startDate: FuzzyDateDto? = null,
    val endDate: FuzzyDateDto? = null,
    val description: String? = null,
    val isAdult: Boolean? = null,
    val studios: NameNodesDto? = null,
    val nextAiringEpisode: NextAiringDto? = null,
    val trailer: TrailerDto? = null,
    // detail-only
    val synonyms: List<String>? = null,
    val source: String? = null,
    val siteUrl: String? = null,
    val rankings: List<RankingDto>? = null,
    val stats: StatsDto? = null,
    val externalLinks: List<ExternalLinkDto>? = null,
    val streamingEpisodes: List<StreamingEpisodeDto>? = null,
    val characters: CharacterConnectionDto? = null,
    val staff: StaffConnectionDto? = null,
    val relations: RelationConnectionDto? = null,
    val recommendations: RecommendationConnectionDto? = null,
    val reviews: ReviewConnectionDto? = null,
)

@Serializable data class RankingDto(val rank: Int, val type: String, val allTime: Boolean? = null, val season: String? = null, val year: Int? = null, val context: String)
@Serializable data class StatsDto(val scoreDistribution: List<ScoreAmountDto>? = null)
@Serializable data class ScoreAmountDto(val score: Int, val amount: Int)
@Serializable data class ExternalLinkDto(val site: String, val url: String? = null, val type: String? = null, val color: String? = null, val language: String? = null)

@Serializable data class StreamingEpisodeDto(val title: String? = null, val thumbnail: String? = null, val url: String? = null, val site: String? = null)
@Serializable data class CharacterConnectionDto(val edges: List<CharacterEdgeDto> = emptyList())
@Serializable data class CharacterEdgeDto(val role: String? = null, val node: PersonNodeDto? = null, val voiceActors: List<PersonNodeDto>? = null)
@Serializable data class PersonNameDto(val full: String? = null, val native: String? = null)
@Serializable data class ImageDto(val large: String? = null, val medium: String? = null)
@Serializable data class PersonNodeDto(val id: Int, val name: PersonNameDto? = null, val image: ImageDto? = null, val languageV2: String? = null)
@Serializable data class StaffConnectionDto(val edges: List<StaffEdgeDto> = emptyList())
@Serializable data class StaffEdgeDto(val role: String? = null, val node: PersonNodeDto? = null)
@Serializable data class RelationConnectionDto(val edges: List<RelationEdgeDto> = emptyList())
@Serializable data class RelationEdgeDto(val relationType: String? = null, val node: MediaDto? = null)
@Serializable data class RecommendationConnectionDto(val nodes: List<RecommendationNodeDto?> = emptyList())
@Serializable data class RecommendationNodeDto(val rating: Int? = null, val mediaRecommendation: MediaDto? = null)
@Serializable data class ReviewConnectionDto(val nodes: List<ReviewDto> = emptyList())
@Serializable data class UserRefDto(val name: String, val avatar: ImageDto? = null)

@Serializable
data class ReviewDto(
    val id: Int,
    val summary: String? = null,
    val body: String? = null,
    val score: Int? = null,
    val rating: Int? = null,
    val ratingAmount: Int? = null,
    val createdAt: Long? = null,
    val user: UserRefDto? = null,
    val media: MediaDto? = null,
)

@Serializable data class PageInfoDto(val currentPage: Int = 1, val hasNextPage: Boolean = false)
@Serializable data class AiringDto(val episode: Int, val airingAt: Long, val media: MediaDto? = null)

@Serializable
data class PageDto(
    val pageInfo: PageInfoDto? = null,
    val media: List<MediaDto>? = null,
    val airingSchedules: List<AiringDto>? = null,
    val reviews: List<ReviewDto>? = null,
)

@Serializable
data class HomeData(
    val trending: PageDto? = null,
    val season: PageDto? = null,
    val upcoming: PageDto? = null,
    val top: PageDto? = null,
    val gems: PageDto? = null,
    val favourites: PageDto? = null,
    val aired: PageDto? = null,
)

@Serializable data class PageData(val Page: PageDto? = null)
@Serializable data class MediaData(val Media: MediaDto? = null)
@Serializable data class TagCollectionItem(val name: String, val category: String? = null, val isAdult: Boolean? = null)
@Serializable data class GenreData(val GenreCollection: List<String>? = null, val MediaTagCollection: List<TagCollectionItem>? = null)

// ---- Authenticated ----
@Serializable data class ViewerDto(val id: Int, val name: String, val avatar: ImageDto? = null, val bannerImage: String? = null)
@Serializable data class ViewerData(val Viewer: ViewerDto? = null)
@Serializable data class ListEntryDto(val id: Int, val status: String? = null, val score: Double? = null, val progress: Int? = null, val repeat: Int? = null, val updatedAt: Long? = null, val media: MediaDto? = null)
@Serializable data class ListGroupDto(val entries: List<ListEntryDto> = emptyList())
@Serializable data class ListCollectionDto(val lists: List<ListGroupDto> = emptyList())
@Serializable data class FavIdsDto(val nodes: List<IdOnly> = emptyList())
@Serializable data class IdOnly(val id: Int)
@Serializable data class FavouritesDto(val anime: FavIdsDto? = null)
@Serializable data class ViewerFavDto(val favourites: FavouritesDto? = null)
@Serializable data class ListsData(val MediaListCollection: ListCollectionDto? = null, val Viewer: ViewerFavDto? = null)
@Serializable data class SaveEntryResult(val id: Int, val status: String? = null, val progress: Int? = null, val updatedAt: Long? = null)
@Serializable data class SaveEntryData(val SaveMediaListEntry: SaveEntryResult? = null)

/** Raw JSON element holder for cache storage. */
@Serializable data class CachedJson(val payload: JsonElement)
