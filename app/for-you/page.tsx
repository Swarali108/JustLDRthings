import type { Metadata } from "next";
import { GuestRecipient } from "@/components/guest/GuestRecipient";

/**
 * `/for-you#d=…` — a page shared by someone without an account.
 *
 * Sibling of `/for-you/[shareToken]`, which serves database-backed pages. This
 * one is a static shell: all content arrives in the URL fragment and is decoded
 * in the recipient's browser, so there is nothing for the server to look up.
 */
export const metadata: Metadata = {
  title: "For You ♡ — JustLDRthings",
  // The content lives in the fragment; there is nothing meaningful to index,
  // and a shared link shouldn't turn up in a search result.
  robots: { index: false, follow: false }
};

export default function GuestRecipientPage() {
  return (
    <div className="preview-shell">
      <GuestRecipient />
    </div>
  );
}
