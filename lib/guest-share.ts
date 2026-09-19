import { z } from "zod";
import { SONG_HOSTS } from "@/lib/validation";
import { styleSchema } from "@/lib/style";
import {
  FLOWER_IDS,
  MAX_STEMS,
  GREENERY_IDS,
  MAX_GREENERY,
  WRAP_IDS,
  RIBBON_IDS
} from "@/lib/flowers";
import { doodleSchema } from "@/lib/doodle";
import type { RenderItem } from "@/components/scrapbook/ItemBlock";

/**
 * Guest sharing: the whole creation travels inside the URL fragment, so nothing
 * is written to the database and nothing is stored in the browser.
 *
 * The fragment (everything after `#`) is never sent to the server — not in the
 * request line, not in logs, not in a referrer. That is the point: a guest link
 * is readable only by someone who already has the link.
 *
 * Cost of that choice: capacity. Only text-shaped creations fit in a URL, which
 * is why GUEST_TYPES excludes media, voice and collage — a photo or an audio
 * clip has to live somewhere a URL cannot reach. A bouquet is only ids and a
 * style, and a doodle is integer stroke geometry rather than a bitmap, so both
 * travel fine.
 */

export const GUEST_TYPES = ["note", "letter", "song", "coupon", "bouquet", "doodle"] as const;
export type GuestType = (typeof GUEST_TYPES)[number];

/** Above this the link still works, but chat apps start truncating it. */
export const LINK_WARN_CHARS = 4000;

/**
 * Anything decoded here arrived from a URL a stranger may have written, so it is
 * validated exactly like form input before it is rendered.
 *
 * The `url` check is load-bearing: `song` renders its url into an `href`, and an
 * unvalidated `javascript:` there would be script execution on our own origin.
 * Reusing the creator's host allow-list keeps the two rules from drifting apart.
 */
const guestItemSchema = z.object({
  type: z.enum(GUEST_TYPES),
  title: z.string().max(200).default(""),
  payload: z
    .object({
      body: z.string().max(8000).optional(),
      paper: z.enum(["cream", "blue", "plum"]).optional(),
      url: z
        .string()
        .max(2000)
        .refine((u) => {
          try {
            const parsed = new URL(u);
            return (
              (parsed.protocol === "https:" || parsed.protocol === "http:") &&
              SONG_HOSTS.includes(parsed.hostname)
            );
          } catch {
            return false;
          }
        }, "unsupported song host")
        .optional(),
      note: z.string().max(500).optional(),
      provider: z.string().max(100).optional(),
      // Bouquet: ordered ids from the closed flower/greenery sets, plus the
      // wrapping and the tie — all looked up, never interpolated raw.
      stems: z.array(z.enum(FLOWER_IDS)).max(MAX_STEMS).optional(),
      greenery: z.array(z.enum(GREENERY_IDS)).max(MAX_GREENERY).optional(),
      wrap: z.enum(WRAP_IDS).optional(),
      ribbon: z.enum(RIBBON_IDS).optional(),
      // Doodle: stroke geometry, bounded in count, length and coordinate range.
      doodle: doodleSchema.optional(),
      // Colour / lettering / placement / decorations — all closed sets too.
      style: styleSchema.optional()
    })
    .strip(),
  coupon: z
    .object({
      coupon_text: z.string().max(200),
      expires_at: z.string().max(40).nullable().default(null)
    })
    .nullable()
    .optional()
});

const guestPayloadSchema = z.object({
  v: z.literal(1),
  title: z.string().max(200).default("For You"),
  items: z.array(guestItemSchema).min(1).max(20)
});

export type GuestItem = z.infer<typeof guestItemSchema>;
export type GuestPayload = z.infer<typeof guestPayloadSchema>;

// ---- encoding -------------------------------------------------------------

const RAW = "1";
const DEFLATED = "2";

type StreamCtor = new (format: string) => {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
};

// Read off globalThis rather than the global name so the module still type-checks
// and still runs where these streams don't exist (older Safari, some webviews).
function streamCtor(name: "CompressionStream" | "DecompressionStream"): StreamCtor | undefined {
  return (globalThis as unknown as Record<string, StreamCtor | undefined>)[name];
}

async function pipe(ctor: StreamCtor, bytes: Uint8Array): Promise<Uint8Array> {
  const transform = new ctor("deflate-raw");
  const writer = transform.writable.getWriter();
  void writer.write(bytes);
  void writer.close();
  const buffer = await new Response(transform.readable).arrayBuffer();
  return new Uint8Array(buffer);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Encode a payload for the fragment. Deflate roughly halves a long letter, which
 * is the difference between a link that survives a chat app and one that doesn't
 * — but it is an optimisation, never a requirement, so we fall back to raw.
 */
export async function encodeGuestPayload(payload: GuestPayload): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const ctor = streamCtor("CompressionStream");

  if (ctor) {
    try {
      const deflated = await pipe(ctor, bytes);
      if (deflated.length < bytes.length) return DEFLATED + toBase64Url(deflated);
    } catch {
      // fall through to raw
    }
  }
  return RAW + toBase64Url(bytes);
}

/** Decode and validate. Returns null for anything malformed, stale or unsafe. */
export async function decodeGuestPayload(encoded: string): Promise<GuestPayload | null> {
  try {
    const marker = encoded.slice(0, 1);
    const body = encoded.slice(1);
    if (marker !== RAW && marker !== DEFLATED) return null;

    let bytes = fromBase64Url(body);
    if (marker === DEFLATED) {
      const ctor = streamCtor("DecompressionStream");
      if (!ctor) return null;
      bytes = await pipe(ctor, bytes);
    }

    const parsed = guestPayloadSchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// ---- rendering ------------------------------------------------------------

/**
 * Adapt a guest item to the same RenderItem the database path produces, so the
 * recipient sees identical markup whether the page came from a URL or a row.
 */
export function guestItemToRenderItem(item: GuestItem, index: number): RenderItem {
  return {
    id: `guest-${index}`,
    type: item.type,
    title: item.title,
    payload: item.payload as Record<string, unknown>,
    media: [],
    coupon: item.coupon
      ? {
          id: `guest-coupon-${index}`,
          coupon_text: item.coupon.coupon_text,
          expires_at: item.coupon.expires_at,
          redeemed_at: null
        }
      : null
  };
}

/** Build the full shareable URL for a payload. */
export async function buildGuestLink(payload: GuestPayload, origin: string): Promise<string> {
  return `${origin.replace(/\/$/, "")}/for-you#d=${await encodeGuestPayload(payload)}`;
}
