import Link from "next/link";
import { signout } from "@/app/(auth)/actions";

/**
 * Header for app pages.
 *
 * Everything is usable without an account, so a guest is offered no way to make
 * one — there is nothing here that requires it. The signed-in branch stays for
 * anyone who already has a session: it is the only way back out to guest, and
 * the only way to reach a scrapbook made earlier.
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
          <Link href="/create" className="button button-plum">
            Make something ✿
          </Link>
        )}
      </div>
    </header>
  );
}
