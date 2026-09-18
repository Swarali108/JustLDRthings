import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// "/create" is deliberately absent: the creators work for guests, who keep their
// work via a link or a download instead of an account. Each creator branches on
// the signed-in state itself rather than being gated here.
const PROTECTED_PREFIXES = ["/dashboard", "/page", "/settings"];

function isProtectedPath(path: string) {
  return PROTECTED_PREFIXES.some((p) => path.startsWith(p));
}

/** Send an unauthenticated visitor to the landing page with a setup hint. */
function redirectToSetup(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  url.searchParams.set("setup", "missing-supabase-env");
  return NextResponse.redirect(url);
}

/**
 * Refreshes the Supabase auth session on every request and guards private
 * routes. Recipient routes (/for-you/*) and the marketing/auth pages stay open.
 */
export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (!hasSupabaseConfig()) {
    return isProtectedPath(path)
      ? redirectToSetup(request)
      : NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: CookieToSet[]) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          }
        }
      }
    );

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user && isProtectedPath(path)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", path);
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  } catch (error) {
    // Auth infrastructure being unreachable must not 404/500 the public site.
    // Public pages render as signed-out; private ones fall back to /login,
    // which fails closed rather than leaking a protected page.
    console.error("[proxy] Supabase session refresh failed:", error);

    if (isProtectedPath(path)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", path);
      return NextResponse.redirect(url);
    }

    return NextResponse.next({ request });
  }
}
