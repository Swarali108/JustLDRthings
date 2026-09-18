import { z } from "zod";

// Paper themes shared by notes and letters.
export const PAPER_THEMES = ["cream", "blue", "plum"] as const;

export const noteSchema = z.object({
  title: z.string().trim().max(80).optional().default(""),
  body: z.string().trim().min(1, "Write a little something.").max(600),
  paper: z.enum(PAPER_THEMES).default("cream")
});

export const letterSchema = z.object({
  title: z.string().trim().max(120).optional().default(""),
  body: z.string().trim().min(1, "Your letter is empty.").max(8000),
  paper: z.enum(PAPER_THEMES).default("cream")
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
  note: z.string().trim().max(500).optional().default("")
});

export const couponSchema = z.object({
  title: z.string().trim().max(80).optional().default(""),
  coupon_text: z.string().trim().min(1, "What are you promising?").max(200),
  // datetime-local value (no timezone) or empty.
  expires_at: z.string().trim().optional().default("")
});

export const mediaMetaSchema = z.object({
  title: z.string().trim().max(120).optional().default(""),
  caption: z.string().trim().max(400).optional().default("")
});

export const voiceMetaSchema = z.object({
  title: z.string().trim().max(120).optional().default(""),
  transcript: z.string().trim().max(1000).optional().default("")
});

export const aiWriteSchema = z.object({
  kind: z.enum(["note", "letter", "caption", "coupon"]),
  prompt: z.string().trim().max(400).optional().default("")
});

export type NoteInput = z.infer<typeof noteSchema>;
export type LetterInput = z.infer<typeof letterSchema>;
export type SongInput = z.infer<typeof songSchema>;
export type CouponInput = z.infer<typeof couponSchema>;
