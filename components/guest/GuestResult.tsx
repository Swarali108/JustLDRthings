"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buildGuestLink, LINK_WARN_CHARS, type GuestPayload } from "@/lib/guest-share";
import {
  buildKeepsakeHtml,
  downloadHtml,
  keepsakeFilename,
  type KeepsakeBlock
} from "@/components/guest/keepsake";

/**
 * What a guest sees after making something.
 *
 * Two ways out, and they are the only two: a link that carries the creation
 * inside it, and a file they keep. Nothing was written down on our side, so this
 * panel has to be honest that leaving the page ends it.
 */
export function GuestResult({
  title,
  payload,
  blocks,
  onEdit,
  unshareableReason
}: {
  title: string;
  /** null when this creation is too big for a URL (photo, video, voice). */
  payload: GuestPayload | null;
  blocks: KeepsakeBlock[];
  onEdit: () => void;
  unshareableReason?: string;
}) {
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!payload) return;
    void buildGuestLink(payload, window.location.origin).then((url) => {
      if (!cancelled) setLink(url);
    });
    return () => {
      cancelled = true;
    };
  }, [payload]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard permission can be refused; the input below is selectable.
      setCopied(false);
    }
  }

  function download() {
    downloadHtml(keepsakeFilename(title), buildKeepsakeHtml(title, blocks));
    setDownloaded(true);
  }

  const tooLong = link.length > LINK_WARN_CHARS;

  return (
    <div className="studio-panel">
      <p className="eyebrow">Made without an account</p>
      <h3 style={{ marginTop: 8 }}>Here it is. ♡</h3>
      <p style={{ lineHeight: 1.6, marginTop: 10 }}>
        Nothing was saved anywhere — not on our side, not in your browser. Take
        the link or the file now, or it&apos;s gone when you close this page.
      </p>

      {payload ? (
        <div className="field" style={{ marginTop: 18 }}>
          <label htmlFor="guest-link">Your private link</label>
          <input
            id="guest-link"
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            placeholder="Making your link…"
          />
          <small style={{ color: "var(--mauve)" }}>
            The whole creation travels inside this link, so it never touches our
            database. Anyone who has it can open it.
          </small>
          {tooLong ? (
            <p className="form-notice" style={{ marginTop: 8 }}>
              This one&apos;s a long link ({link.length.toLocaleString()} characters).
              Some chat apps cut long links in half — send it somewhere that
              won&apos;t, or sign in for a short one.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="form-notice" style={{ marginTop: 18 }}>
          {unshareableReason ||
            "This one's too big to fit in a link — download it below, or sign in to share it properly."}
        </p>
      )}

      <div className="row-actions" style={{ marginTop: 18 }}>
        {payload ? (
          <button
            type="button"
            className="button button-plum"
            onClick={copy}
            disabled={!link}
          >
            {copied ? "Copied ♡" : "Copy link"}
          </button>
        ) : null}

        <button type="button" className="button button-light" onClick={download}>
          {downloaded ? "Downloaded ♡" : "Save to my laptop"}
        </button>

        <button type="button" className="button button-light" onClick={onEdit}>
          Keep editing
        </button>
      </div>

      {payload && link ? (
        <p style={{ marginTop: 14 }}>
          <a
            href={link}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-link"
          >
            Open it the way they&apos;ll see it →
          </a>
        </p>
      ) : null}

      <p style={{ marginTop: 18, color: "var(--mauve)", lineHeight: 1.6 }}>
        Want it kept for you, gathered onto one page, and shareable with a short
        link?{" "}
        <Link href="/signup" className="inline-link">
          Make an account
        </Link>{" "}
        — it starts empty, so save this one first.
      </p>
    </div>
  );
}
