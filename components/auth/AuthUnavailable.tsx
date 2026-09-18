import Link from "next/link";

/**
 * Shown on /login and /signup when Supabase isn't configured for this
 * environment. Accounts genuinely cannot work here, so this states that plainly
 * rather than letting the page throw a 500 at someone who can't act on it.
 */
export function AuthUnavailable() {
  return (
    <main className="auth-shell">
      <Link href="/" className="brand auth-brand">
        JustLDRthings <span aria-hidden>♡</span>
      </Link>

      <div className="studio-panel" style={{ maxWidth: 460 }}>
        <p className="eyebrow">Accounts are having a moment</p>
        <h3 style={{ marginTop: 8 }}>Signing in isn&apos;t available right now. ♡</h3>
        <p style={{ lineHeight: 1.6, marginTop: 10 }}>
          Nothing you&apos;ve made is lost — this is a setup issue on our side, not
          anything you did. Try again in a little while.
        </p>
        <div className="row-actions" style={{ marginTop: 18 }}>
          <Link href="/" className="button button-plum">
            Back to the start
          </Link>
        </div>
      </div>
    </main>
  );
}
