import Link from "next/link";
import { signout } from "@/app/(auth)/actions";

/** Header for signed-in app pages (dashboard, creators, composer). */
export function AppHeader({ name }: { name?: string | null }) {
  return (
    <header className="nav app-nav">
      <Link href="/dashboard" className="brand">
        JustLDRthings <span aria-hidden>♡</span>
      </Link>
      <div className="nav-actions">
        {name ? <span className="app-hello">Hi, {name} ♡</span> : null}
        <Link href="/dashboard" className="button button-light">
          Dashboard
        </Link>
        <form action={signout}>
          <button type="submit" className="button button-light">
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
