import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

/**
 * Who is making this request, for rate-limiting purposes.
 *
 * The AI routes are open to guests — everything in this app is usable without
 * an account, and signing in only buys you somewhere to keep things. So there
 * is not always a user id to limit against, and the fallback is the client IP.
 *
 * Be clear about what that fallback is worth: an IP bucket is weak. Several
 * people behind one office or campus NAT share a bucket and get throttled as
 * though they were one person, while anyone determined can rotate addresses and
 * walk past it. It raises the effort of casual abuse. It is not a wall, and the
 * API key behind these routes is spendable by anyone who finds the URL.
 *
 * If that key ever matters enough to protect properly, the answer is a signed
 * proof-of-work or a captcha on the guest path, not a tighter IP cap.
 */

export interface Caller {
  /** Supabase user id when signed in. */
  userId: string | null;
  /** Bucket key for the rate limiter. */
  key: string;
  signedIn: boolean;
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // Left-most entry is the original client; the rest are proxies.
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Identify the caller without ever refusing one.
 *
 * Auth failure resolves to "guest", the same way `isSignedIn()` does — an
 * unreachable Supabase must not take down a creator that does not need it.
 */
export async function identifyCaller(request: Request, scope: string): Promise<Caller> {
  if (hasSupabaseConfig()) {
    try {
      const supabase = await createClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (user) {
        return { userId: user.id, key: `${scope}:u:${user.id}`, signedIn: true };
      }
    } catch {
      // fall through to the guest bucket
    }
  }

  return { userId: null, key: `${scope}:ip:${clientIp(request)}`, signedIn: false };
}
