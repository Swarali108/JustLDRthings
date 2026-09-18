import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

/**
 * "Is someone signed in?" for pages that work either way.
 *
 * Deliberately different from the `requireUser()` helpers in the action files:
 * those exist to *block*, this exists to *branch*. It never throws and never
 * redirects — a creator page has to keep working for a guest even when auth is
 * unreachable, so every failure resolves to "treat this visitor as a guest".
 *
 * `cache()` dedupes it across one render: the create layout and the creator page
 * inside it both ask, and that should cost one round trip, not two.
 */
export const isSignedIn = cache(async function isSignedIn(): Promise<boolean> {
  if (!hasSupabaseConfig()) return false;

  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    return Boolean(user);
  } catch {
    return false;
  }
});
