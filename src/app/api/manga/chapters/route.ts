import { NextRequest, NextResponse } from "next/server";
import { searchMangaDex, getMangaDexChapters } from "@/lib/manga/providers/mangadex";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title");
  const romaji = searchParams.get("romaji");
  const english = searchParams.get("english");
  const mangaDexIdParam = searchParams.get("mangaDexId");

  try {
    let mangaDexId = mangaDexIdParam;

    if (!mangaDexId) {
      const candidates = [english, title, romaji].filter(Boolean) as string[];
      if (candidates.length === 0) {
        return NextResponse.json(
          { error: "At least one title parameter is required (title, english, or romaji)" },
          { status: 400 }
        );
      }

      const match = await searchMangaDex(candidates);
      if (!match) {
        return NextResponse.json({
          mangaDexId: null,
          chapters: [],
          message: "No MangaDex match found for this title",
        });
      }
      mangaDexId = match.id;
    }

    const chapters = await getMangaDexChapters(mangaDexId);

    return NextResponse.json(
      {
        mangaDexId,
        chapters,
        total: chapters.length,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    console.error("[api/manga/chapters] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch chapters", chapters: [] },
      { status: 500 }
    );
  }
}
