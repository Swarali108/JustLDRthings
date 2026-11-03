import { createClient } from "@/lib/supabase/server";
import { isSignedIn } from "@/lib/auth";
import { AppHeader } from "@/components/app/AppHeader";

export const dynamic = "force-dynamic";

/**
 * Chrome for every creator. Unlike the other private areas this one does NOT
 * redirect a signed-out visitor: making something is the part of the app that
 * works without an account. The banner sets the expectation up front, because
 * guest work is never written down — closing the tab really does end it.
 */
export default async function CreateLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const signedIn = await isSignedIn();

  let name: string | null = null;
  if (signedIn) {
    try {
      const supabase = await createClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", user.id)
          .maybeSingle();
        name = profile?.display_name ?? null;
      }
    } catch {
      name = null;
    }
  }

  return (
    <div className="site-shell">
      <AppHeader name={name} signedIn={signedIn} />

      {!signedIn ? (
        <p className="banner">
          Nothing is saved while you make this. When you&apos;re done you can
          copy a private link or save it to your laptop. ♡
        </p>
      ) : null}

      {children}
    </div>
  );
}
