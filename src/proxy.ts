import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie on authenticated API routes that require
 * a server-verified user session. Public pages, RSC navigations, and cached APIs
 * bypass Node.js middleware completely to preserve CDN caching and zero CPU usage.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  // Skip Supabase Auth network round-trip when caller has no Supabase session cookie.
  const cookies = request.cookies.getAll();
  const hasSessionCookie = cookies.some((c) => c.name.startsWith("sb-") || c.name.includes("auth-token"));
  if (!hasSessionCookie) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => cookies,
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/api/account/:path*", "/api/integrations/:path*"],
};
