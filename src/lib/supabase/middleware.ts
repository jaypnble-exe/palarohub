import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { getSupabaseConfig, hasSupabaseConfig } from "./env";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;
  const protectedPath =
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path === "/team" ||
    path.startsWith("/team/") ||
    path === "/leagues";
  let signedIn = false;
  if (hasSupabaseConfig()) {
    const { url, key } = getSupabaseConfig();
    const supabase = createServerClient<Database>(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });
    const { data, error } = await supabase.auth.getClaims();
    // Anonymous scorer-device sessions do not unlock account pages.
    signedIn =
      !error && Boolean(data?.claims?.sub) && !data?.claims?.is_anonymous;
  }
  // Refresh responses and signed-in screens must never be shared by a CDN.
  response.headers.set("Cache-Control", "private, no-store");
  if (protectedPath && !signedIn) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/login";
    destination.search = "";
    destination.searchParams.set("next", path + request.nextUrl.search);
    const redirectResponse = NextResponse.redirect(destination);
    response.cookies
      .getAll()
      .forEach((cookie) => redirectResponse.cookies.set(cookie));
    redirectResponse.headers.set("Cache-Control", "private, no-store");
    return redirectResponse;
  }
  return response;
}
