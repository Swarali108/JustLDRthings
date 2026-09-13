import Link from "next/link";
import { CREATIONS } from "@/lib/content-types";
import { Icon, type IconName } from "@/components/ui/Icon";

export default function LandingPage() {
  return (
    <div className="site-shell">
      <nav className="nav">
        <Link href="/" className="brand">
          JustLDRthings <span aria-hidden>♡</span>
        </Link>
        <div className="nav-links">
          <a href="#how">How it works</a>
          <a href="#make">What you can make</a>
          <a href="#private">Privacy</a>
        </div>
        <div className="nav-actions">
          <Link href="/login" className="button button-light">
            Log in
          </Link>
          <Link href="/signup" className="button button-plum">
            Sign up
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Made for long-distance hearts ♡</p>
          <h1>
            Little things, <span className="script">Big feelings.</span>
          </h1>
          <p>
            Create, collect and share little moments of love that bridge the
            distance. One beautiful page, one private link — made just for them.
          </p>
          <div className="hero-actions">
            <Link href="/signup" className="button button-primary">
              Create something ✿
            </Link>
            <a href="#how" className="button button-ghost">
              See how it works →
            </a>
          </div>
          <p className="kicker">Little things, big feelings. ♡</p>
        </div>

        {/* Decorative scrapbook collage */}
        <div className="hero-art" aria-hidden>
          <div className="flower-bloom plum-flower" />
          <div className="collage-photo photo-door" />
          <div className="paper-note">you make far feel close ♡</div>
          <div className="flower-bloom hydrangea" />
          <div className="shell-card" />
          <div className="collage-photo photo-ocean" />
          <div className="polaroid" />
          <div className="berry-card" />
          <div className="ribbon" />
          <div className="hero-tabs">
            {["Doodle", "Bouquet", "Voice", "Letter"].map((t) => (
              <span key={t} className="hero-tab">
                <strong>{t}</strong>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="section blue-band">
        <p className="eyebrow">How it works</p>
        <h2>Create → Collect → Share</h2>
        <div className="feature-grid">
          <article className="feature-card">
            <h3>Create</h3>
            <p>
              Make notes, letters, voice notes, coupons, songs and photo
              moments — no design skills needed.
            </p>
          </article>
          <article className="feature-card">
            <h3>Collect</h3>
            <p>
              Gather your favorite little things onto one scrapbook page and
              arrange them just how you want.
            </p>
          </article>
          <article className="feature-card">
            <h3>Share</h3>
            <p>
              Send one private link. They open it and feel the whole thing was
              made just for them.
            </p>
          </article>
        </div>
      </section>

      {/* What you can make */}
      <section id="make" className="section">
        <div className="create-heading">
          <p className="eyebrow">What you can make</p>
          <h2>Little gestures, big feelings</h2>
        </div>
        <div className="creation-grid">
          {CREATIONS.map((c) => (
            <div key={c.type} className="creation-card">
              <Icon name={c.icon as IconName} size={26} />
              <strong>{c.label}</strong>
              <span className="microcopy" style={{ margin: 0, fontSize: "1rem" }}>
                {c.microcopy}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Privacy */}
      <section id="private" className="section blue-band">
        <p className="eyebrow">Private by default</p>
        <h2>Just for the two of you</h2>
        <p className="section-lead">
          Everything you make is private. Your partner only sees a page through a
          unique, high-entropy link that you can disable or rotate any time. No
          public feed, no followers — just the little things.
        </p>
        <div className="hero-actions" style={{ marginTop: 20 }}>
          <Link href="/signup" className="button button-plum">
            Create something ✿
          </Link>
        </div>
      </section>

      <footer className="site-footer">
        JustLDRthings ♡ · Little things, big feelings.
      </footer>
    </div>
  );
}
