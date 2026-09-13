import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Privileged, service-role Supabase client. SERVER-ONLY.
 *
 * Never import this into a Client Component. It bypasses RLS, so it is used only
 * for tightly-scoped operations the anon key cannot do — chiefly signing private
 * media URLs for a recipient after their share token has already been validated.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
