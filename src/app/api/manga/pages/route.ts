import { NextRequest, NextResponse } from "next/server";
import { getMangaDexPages } from "@/lib/manga/providers/mangadex";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const chapterId = searchParams.get("chapterId");

  if (!chapterId) {
    return NextResponse.json(
      { error: "chapterId parameter is required" },
      { status: 400 }
    );
  }

  try {
    const pages = await getMangaDexPages(chapterId);

    return NextResponse.json(
      {
        chapterId,
        pages,
        total: pages.length,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=7200, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    console.error("[api/manga/pages] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch chapter pages", pages: [] },
      { status: 500 }
    );
  }
}
