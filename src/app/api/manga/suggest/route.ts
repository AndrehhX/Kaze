import { json } from "@/lib/api-response";

export async function GET() {
  return json(
    { maintenance: true, results: [] },
    { cache: "public, max-age=3600, s-maxage=86400" }
  );
}
