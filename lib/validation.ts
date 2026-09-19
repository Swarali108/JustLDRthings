import { z } from "zod";
import {
  FLOWER_IDS,
  MAX_STEMS,
  GREENERY_IDS,
  MAX_GREENERY,
  WRAP_IDS,
  RIBBON_IDS
} from "@/lib/flowers";
import { doodleSchema } from "@/lib/doodle";
import { paperChoiceSchema } from "@/lib/paper";
import { envelopeSchema, sealSchema } from "@/lib/envelope";
import { couponDesignSchema } from "@/lib/coupon-designs";
import { styleSchema } from "@/lib/style";

// Paper themes shared by notes and letters.
export const PAPER_THEMES = ["cream", "blue", "plum"] as const;

/**
 * Paper arrives either as the new {color, pattern} object or, from links and
 * rows created before patterns existed, as a bare colour string. Both must keep
 * working, so the old shape is promoted rather than rejected.
 */
const paperField = z.preprocess(
  (v) => (typeof v === "string" ? { color: v, pattern: "plain" } : v),
  paperChoiceSchema
).default({ color: "cream", pattern: "plain" });

export const noteSchema = z.object({
  title: z.string().trim().max(80).optional().default(""),
  body: z.string().trim().min(1, "Write a little something.").max(600),
  paper: paperField,
  style: styleSchema.optional()
});

export const letterSchema = z.object({
  title: z.string().trim().max(120).optional().default(""),
  body: z.string().trim().min(1, "Your letter is empty.").max(8000),
  paper: paperField,
  // A sealed letter arrives as a closed envelope the recipient clicks to open.
  sealed: z.coerce.boolean().optional().default(false),
  envelope: envelopeSchema.optional(),
  seal: sealSchema.optional(),
  style: styleSchema.optional()
});

// Allow-list of hosts we render as a "song" link, to avoid arbitrary embeds.
// Exported so the guest-link decoder enforces the identical rule on untrusted
// payloads — two copies of this list would drift and open a hole.
export const SONG_HOSTS = [
  "open.spotify.com",
  "spotify.com",
  "music.apple.com",
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "soundcloud.com"
];

export const songSchema = z.object({
  title: z.string().trim().max(120).optional().default(""),
  url: z
    .string()
    .trim()
    .url("Paste a full link (https://…).")
    .refine((u) => {
      try {
        return SONG_HOSTS.includes(new URL(u).hostname);
      } catch {
        return false;
      }
    }, "Use a Spotify, Apple Music, YouTube or SoundCloud link."),
  note: z.string().trim().max(500).optional().default(""),
  style: styleSchema.optional()
});

export const couponSchema = z.object({
  title: z.string().trim().max(80).optional().default(""),
  coupon_text: z.string().trim().min(1, "What are you promising?").max(200),
  // datetime-local value (no timezone) or empty.
  expires_at: z.string().trim().optional().default(""),
  design: couponDesignSchema.optional(),
  style: styleSchema.optional()
});

export const mediaMetaSchema = z.object({
  title: z.string().trim().max(120).optional().default(""),
  caption: z.string().trim().max(400).optional().default(""),
  style: styleSchema.optional()
});

export const voiceMetaSchema = z.object({
  title: z.string().trim().max(120).optional().default(""),
  transcript: z.string().trim().max(1000).optional().default(""),
  style: styleSchema.optional()
});

export const bouquetSchema = z.object({
  title: z.string().trim().max(120).optional().default(""),
  // Stems are stored as flower ids, in pick order -- the arrangement IS the order.
  stems: z.array(z.enum(FLOWER_IDS)).min(1, "Pick at least one flower.").max(MAX_STEMS),
  greenery: z.array(z.enum(GREENERY_IDS)).max(MAX_GREENERY).optional().default([]),
  wrap: z.enum(WRAP_IDS).optional().default("peach"),
  ribbon: z.enum(RIBBON_IDS).optional().default("peach"),
  note: z.string().trim().max(400).optional().default(""),
  style: styleSchema.optional()
});

export const doodleItemSchema = z.object({
  title: z.string().trim().max(120).optional().default(""),
  doodle: doodleSchema,
  note: z.string().trim().max(400).optional().default(""),
  style: styleSchema.optional()
});

export const collageMetaSchema = z.object({
  title: z.string().trim().max(120).optional().default(""),
  caption: z.string().trim().max(400).optional().default(""),
  style: styleSchema.optional()
});

export const aiWriteSchema = z.object({
  kind: z.enum(["note", "letter", "caption", "coupon"]),
  prompt: z.string().trim().max(400).optional().default("")
});

export type NoteInput = z.infer<typeof noteSchema>;
export type LetterInput = z.infer<typeof letterSchema>;
export type SongInput = z.infer<typeof songSchema>;
export type CouponInput = z.infer<typeof couponSchema>;
export type BouquetInput = z.infer<typeof bouquetSchema>;
