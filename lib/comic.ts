import { z } from "zod";
import { avatarPairSchema } from "@/lib/avatar";

/**
 * The comic: what the model is allowed to say, and what gets drawn.
 *
 * The model writes a SCRIPT, never a picture. It chooses from fixed lists of
 * poses, expressions and backgrounds, and the app draws the result from its own
 * SVG library. That is what keeps the two characters looking like the same two
 * people in every panel — which generated images famously do not — and it makes
 * every panel free and instant to render.
 *
 * Because the model only ever emits enum members, an invalid script is a
 * validation failure rather than something odd on the page.
 */

export const BACKGROUNDS = [
  "cafe", "park", "bedroom", "airport", "videocall", "nightsky", "station"
] as const;

export const POSES = ["standing", "waving", "hugging", "onphone", "sitting", "running"] as const;

export const EXPRESSIONS = [
  "happy", "laughing", "shy", "sad", "surprised", "sleepy"
] as const;

export const POSITIONS = ["left", "center", "right"] as const;
export const SPEAKERS = ["A", "B", "narrator"] as const;
export const PANEL_COUNTS = [2, 4, 6] as const;

export type Background = (typeof BACKGROUNDS)[number];
export type Pose = (typeof POSES)[number];
export type Expression = (typeof EXPRESSIONS)[number];
export type Position = (typeof POSITIONS)[number];
export type Speaker = (typeof SPEAKERS)[number];
export type PanelCount = (typeof PANEL_COUNTS)[number];

export const BACKGROUND_LABELS: Record<Background, string> = {
  cafe: "Café",
  park: "Park",
  bedroom: "Bedroom",
  airport: "Airport",
  videocall: "Video call",
  nightsky: "Night sky",
  station: "Train station"
};

export const POSE_LABELS: Record<Pose, string> = {
  standing: "Standing",
  waving: "Waving",
  hugging: "Hugging",
  onphone: "On the phone",
  sitting: "Sitting",
  running: "Running"
};

export const EXPRESSION_LABELS: Record<Expression, string> = {
  happy: "Happy",
  laughing: "Laughing",
  shy: "Shy",
  sad: "Sad",
  surprised: "Surprised",
  sleepy: "Sleepy"
};

/** Hard caps. Dialogue is capped so a bubble can always be made to fit. */
export const MAX_DIALOGUE_CHARS = 80;
export const MAX_CAPTION_CHARS = 60;
export const MAX_LINES_PER_PANEL = 3;
export const MAX_CHARACTERS_PER_PANEL = 2;

export const comicCharacterSchema = z.object({
  who: z.enum(["A", "B"]),
  pose: z.enum(POSES),
  expression: z.enum(EXPRESSIONS),
  position: z.enum(POSITIONS)
});

export const dialogueSchema = z.object({
  speaker: z.enum(SPEAKERS),
  text: z.string().trim().min(1).max(MAX_DIALOGUE_CHARS)
});

export const panelSchema = z.object({
  background: z.enum(BACKGROUNDS),
  characters: z.array(comicCharacterSchema).max(MAX_CHARACTERS_PER_PANEL),
  dialogue: z.array(dialogueSchema).max(MAX_LINES_PER_PANEL).default([]),
  caption: z.string().trim().max(MAX_CAPTION_CHARS).optional()
});

export const modelComicSchema = z.object({
  title: z.string().trim().min(1).max(60),
  panels: z.array(panelSchema).min(2).max(6)
});

export type ComicCharacter = z.infer<typeof comicCharacterSchema>;
export type Dialogue = z.infer<typeof dialogueSchema>;
export type Panel = z.infer<typeof panelSchema>;
export type ModelComic = z.infer<typeof modelComicSchema>;

/** What gets stored and rendered: the script plus the two faces it is drawn with. */
export const comicSchema = z.object({
  title: z.string().trim().min(1).max(60),
  panels: z.array(panelSchema).min(2).max(6),
  avatars: avatarPairSchema,
  /** An optional doodle laid over the whole page, from the existing canvas. */
  overlay: z
    .object({
      strokes: z.array(z.unknown()).max(0).optional()
    })
    .nullable()
    .default(null)
});

export type Comic = z.infer<typeof comicSchema>;

// ---------------------------------------------------------------------------
// Bubble sizing
// ---------------------------------------------------------------------------

/**
 * Font size for a speech bubble, in panel units.
 *
 * The brief is "shrink the font, then wrap, and never overflow". Wrapping alone
 * is not enough: three long lines in a small panel will spill however neatly
 * they wrap. So the size steps down as the text grows, and because the schema
 * caps dialogue at 80 characters there is a worst case that can be sized for
 * rather than hoped about.
 *
 * Pure, so the steps can be asserted instead of eyeballed.
 */
export function bubbleFontSize(text: string, panelWidth = 300): number {
  const base = panelWidth / 300;
  const n = text.trim().length;

  const size = n <= 24 ? 15 : n <= 40 ? 13.5 : n <= 60 ? 12 : 10.5;
  return Math.round(size * base * 10) / 10;
}

/** Rough wrapped height, used to keep bubbles inside the panel. */
export function bubbleLines(text: string, charsPerLine = 26): number {
  const words = text.trim().split(/\s+/);
  let lines = 1;
  let run = 0;

  for (const word of words) {
    // A word longer than the line gets its own; it will break anyway.
    if (run > 0 && run + 1 + word.length > charsPerLine) {
      lines++;
      run = word.length;
    } else {
      run = run === 0 ? word.length : run + 1 + word.length;
    }
  }
  return lines;
}

/**
 * Where the characters stand, given how many are in the panel.
 *
 * A video call is the exception the brief calls for: the two are not in one
 * room, they are each in their own half of a split screen, which is the whole
 * point of the background.
 */
export function layoutFor(
  characters: ComicCharacter[],
  background: Background
): { character: ComicCharacter; x: number; half: "left" | "right" | null }[] {
  if (background === "videocall") {
    return characters.slice(0, 2).map((character, i) => ({
      character,
      x: i === 0 ? 25 : 75,
      half: i === 0 ? ("left" as const) : ("right" as const)
    }));
  }

  const xFor = (p: Position) => (p === "left" ? 28 : p === "right" ? 72 : 50);

  // Two characters that both asked for the same spot would overlap; nudge them.
  const placed = characters.map((character) => ({ character, x: xFor(character.position), half: null }));
  if (placed.length === 2 && Math.abs(placed[0].x - placed[1].x) < 20) {
    placed[0].x = 32;
    placed[1].x = 68;
  }
  return placed;
}
