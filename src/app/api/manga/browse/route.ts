import { json } from "@/lib/api-response";

export async function GET() {
  return json(
    {
      maintenance: true,
      media: [],
      pageInfo: { total: 0, perPage: 30, currentPage: 1, lastPage: 1, hasNextPage: false },
    },
    { cache: "public, max-age=3600, s-maxage=86400" }
  );
}
