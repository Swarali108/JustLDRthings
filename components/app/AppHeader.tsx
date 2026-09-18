import Link from "next/link";
import { signout } from "@/app/(auth)/actions";

/**
 * Header for app pages. Creators are reachable without an account, so this has
 * to render for a guest too — and for a guest it offers the way in rather than
 * the way out.
 */
export function AppHeader({
  name,
  signedIn = true
}: {
  name?: string | null;
  signedIn?: boolean;
}) {
  return (
    <header className="nav app-nav">
      <Link href={signedIn ? "/dashboard" : "/"} className="brand">
        JustLDRthings <span aria-hidden>♡</span>
      </Link>
      <div className="nav-actions">
        {signedIn ? (
          <>
            {name ? <span className="app-hello">Hi, {name} ♡</span> : null}
            <Link href="/dashboard" className="button button-light">
              Dashboard
            </Link>
            <form action={signout}>
              <button type="submit" className="button button-light">
                Log out
              </button>
            </form>
          </>
        ) : (
          <>
            <Link href="/login" className="button button-light">
              Log in
            </Link>
            <Link href="/signup" className="button button-plum">
              Sign up
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
