"use client";

import { useState, useTransition } from "react";
import { publishAndShare, disableShare } from "@/app/page/actions";

export function SharePanel({
  pageId,
  initiallyPublished
}: {
  pageId: string;
  initiallyPublished: boolean;
}) {
  const [published, setPublished] = useState(initiallyPublished);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function publish() {
    setError("");
    startTransition(async () => {
      const res = await publishAndShare(pageId);
      if (res.ok && res.url) {
        setPublished(true);
        setUrl(res.url);
      } else {
        setError(res.error || "Could not create a link.");
      }
    });
  }

  function stop() {
    startTransition(async () => {
      await disableShare(pageId);
      setPublished(false);
      setUrl(null);
    });
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked; user can select manually */
    }
  }

  return (
    <div className="share-box composer-share">
      <p className="eyebrow">Share</p>
      <h3>Almost done! ♡</h3>

      {url ? (
        <>
          <p className="share-lead">Here&apos;s your link. Share it with your person.</p>
          <div className="link-box">
            <input readOnly value={url} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="button button-plum" onClick={copy}>
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <div className="share-actions">
            <a href={url} target="_blank" rel="noreferrer" className="button button-light">
              View as your partner
            </a>
            <button type="button" className="button button-light" onClick={stop} disabled={pending}>
              Stop sharing
            </button>
          </div>
        </>
      ) : published ? (
        <>
          <p className="share-lead">
            Your page is shared. For safety we only show a link once — make a fresh
            one to copy it again.
          </p>
          <div className="share-actions">
            <button type="button" className="button button-plum" onClick={publish} disabled={pending}>
              {pending ? "Working…" : "Get a new link"}
            </button>
            <button type="button" className="button button-light" onClick={stop} disabled={pending}>
              Stop sharing
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="share-lead">
            When it feels ready, publish it and get one private link to send.
          </p>
          <button type="button" className="button button-plum" onClick={publish} disabled={pending}>
            {pending ? "Working…" : "Publish & create link"}
          </button>
        </>
      )}

      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
