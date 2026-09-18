"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ScrapbookPage } from "@/components/scrapbook/ScrapbookPage";
import { decodeGuestPayload, guestItemToRenderItem } from "@/lib/guest-share";
import type { RenderItem } from "@/components/scrapbook/ItemBlock";

type Status = "reading" | "ready" | "empty";

/**
 * Renders a guest-shared page out of the URL fragment.
 *
 * This is a Client Component for a reason beyond convenience: `location.hash`
 * is never transmitted to the server, so the only way to read it is here, in the
 * recipient's own browser. The content of a guest link never reaches our logs.
 */
export function GuestRecipient() {
  const [status, setStatus] = useState<Status>("reading");
  const [title, setTitle] = useState("For You");
  const [items, setItems] = useState<RenderItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function read() {
      const hash = window.location.hash.replace(/^#/, "");
      const encoded = new URLSearchParams(hash).get("d");

      if (!encoded) {
        if (!cancelled) setStatus("empty");
        return;
      }

      const payload = await decodeGuestPayload(encoded);
      if (cancelled) return;

      if (!payload) {
        setStatus("empty");
        return;
      }

      setTitle(payload.title);
      setItems(payload.items.map(guestItemToRenderItem));
      setStatus("ready");
    }

    void read();
    // A pasted link can change the hash without remounting the component.
    window.addEventListener("hashchange", read);
    return () => {
      cancelled = true;
      window.removeEventListener("hashchange", read);
    };
  }, []);

  if (status === "reading") {
    return (
      <main className="recipient">
        <header className="reveal-hero">
          <p className="script-lg">For You ♡</p>
        </header>
      </main>
    );
  }

  if (status === "empty") {
    return (
      <main className="recipient not-found">
        <p className="script-lg">Hmm ♡</p>
        <h1>This link isn&apos;t available.</h1>
        <p style={{ lineHeight: 1.6 }}>
          It may have been cut short when it was sent — long links sometimes get
          trimmed by chat apps. Ask your person to send the whole thing again.
        </p>
        <Link href="/" className="button button-plum" style={{ marginTop: 16 }}>
          About JustLDRthings ♡
        </Link>
      </main>
    );
  }

  // No `token` prop: a guest coupon has nothing to redeem against, so it renders
  // as a keepsake rather than offering a button that could not work.
  return <ScrapbookPage title={title} items={items} />;
}
