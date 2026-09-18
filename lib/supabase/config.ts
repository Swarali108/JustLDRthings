/**
 * Is Supabase actually usable in this environment?
 *
 * A truthy env var is not enough: pasting a Supabase *key* into the URL slot is
 * an easy mistake, and `createServerClient` throws on a non-URL. Anything that
 * builds a Supabase client on a request path must check this first, or a missing
 * dashboard variable becomes a 500 instead of a message someone can act on.
 */
export function hasSupabaseConfig(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return false;

  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}
