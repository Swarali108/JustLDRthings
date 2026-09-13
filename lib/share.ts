import { createHash, randomBytes } from "crypto";

// SERVER-ONLY helpers (node:crypto). Never import into a Client Component.

/** High-entropy, URL-safe share token shown to the creator exactly once per rotation. */
export function generateShareToken(): string {
  return randomBytes(24).toString("base64url");
}

/** We store only the SHA-256 hash of a token; the raw token lives in the URL. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Absolute recipient URL for a raw token. */
export function shareUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/for-you/${token}`;
}
