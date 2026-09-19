import { z } from "zod";

/**
 * Paper for notes and letters: a colour and, separately, a surface pattern.
 *
 * Two axes rather than one combined list — five colours times five patterns is
 * twenty-five looks from ten choices, and either can gain an option without
 * touching the other. Both are closed sets: they become CSS class names, and a
 * guest link is written by whoever sends it.
 *
 * Values are kept as literal CSS here (not `var(--…)`) because the downloaded
 * keepsake has no stylesheet and must render the same paper offline.
 */

export const PAPER_COLORS = ["cream", "blue", "plum", "coffee", "aesthetic"] as const;
export const PAPER_PATTERNS = ["plain", "crinkled", "lines", "torn", "hearts"] as const;

export type PaperColor = (typeof PAPER_COLORS)[number];
export type PaperPattern = (typeof PAPER_PATTERNS)[number];

export const PAPER_COLOR_LABELS: Record<PaperColor, string> = {
  cream: "Warm cream",
  blue: "Powder blue",
  plum: "Deep plum",
  coffee: "Light coffee",
  aesthetic: "Aesthetic wash"
};

export const PAPER_PATTERN_LABELS: Record<PaperPattern, string> = {
  plain: "Plain",
  crinkled: "Crinkled",
  lines: "Ruled lines",
  torn: "Torn edge",
  hearts: "Hearts"
};

export interface PaperSkin {
  /** Base fill. */
  bg: string;
  /** Text colour that stays readable on it. */
  ink: string;
  /** A muted tone for secondary text. */
  muted: string;
  /** Tint used by the pattern overlays. */
  line: string;
}

export const PAPER_SKINS: Record<PaperColor, PaperSkin> = {
  cream: { bg: "#f7f3ef", ink: "#211622", muted: "#8c657c", line: "rgba(140,101,124,.30)" },
  blue: { bg: "#e7eef7", ink: "#1d2f3d", muted: "#5f7f9a", line: "rgba(53,106,137,.28)" },
  plum: { bg: "#43182c", ink: "#f4e9d8", muted: "#c7ab9b", line: "rgba(244,233,216,.26)" },
  coffee: { bg: "#e4d5c3", ink: "#42301f", muted: "#8a6f52", line: "rgba(90,66,40,.30)" },
  aesthetic: { bg: "#f2e6ee", ink: "#3d2438", muted: "#8a6b80", line: "rgba(122,74,106,.26)" }
};

/**
 * Pattern overlays as CSS `background` layers, sitting above the base colour.
 *
 * `torn` is the odd one: a torn edge is a *shape*, not a fill, so it is applied
 * as a clip-path in CSS instead. It appears here with no layers so the two lists
 * stay the same length and the lookup never has a hole.
 */
export const PAPER_PATTERN_LAYERS: Record<PaperPattern, (line: string) => string> = {
  plain: () => "",
  crinkled: (line) =>
    `linear-gradient(105deg, ${line} 0 1px, transparent 1px 9px),` +
    `linear-gradient(255deg, ${line} 0 1px, transparent 1px 14px),` +
    `linear-gradient(15deg, ${line} 0 1px, transparent 1px 22px)`,
  lines: (line) => `repeating-linear-gradient(180deg, transparent 0 27px, ${line} 27px 28px)`,
  torn: () => "",
  hearts: (line) =>
    `radial-gradient(circle at 5px 7px, ${line} 2.2px, transparent 2.4px),` +
    `radial-gradient(circle at 10px 7px, ${line} 2.2px, transparent 2.4px),` +
    `linear-gradient(135deg, transparent 46%, ${line} 46% 54%, transparent 54%)`
};

/** The inline style for a piece of paper — works in the app and the keepsake. */
export function paperStyle(color: PaperColor, pattern: PaperPattern): Record<string, string> {
  const skin = PAPER_SKINS[color] ?? PAPER_SKINS.cream;
  const layers = (PAPER_PATTERN_LAYERS[pattern] ?? PAPER_PATTERN_LAYERS.plain)(skin.line);

  const style: Record<string, string> = {
    background: layers ? `${layers}, ${skin.bg}` : skin.bg,
    color: skin.ink
  };
  if (pattern === "hearts") style.backgroundSize = "22px 22px";
  return style;
}

export const paperChoiceSchema = z.object({
  color: z.enum(PAPER_COLORS).default("cream"),
  pattern: z.enum(PAPER_PATTERNS).default("plain")
});

export type PaperChoice = z.infer<typeof paperChoiceSchema>;

export const DEFAULT_PAPER: PaperChoice = { color: "cream", pattern: "plain" };

/**
 * Read a paper choice off a payload.
 *
 * Handles the older shape too: notes and letters used to store `paper: "cream"`
 * as a bare string. Those rows and any links already sent still have to render,
 * so a string is promoted to `{ color, pattern: "plain" }` rather than discarded.
 */
export function readPaper(payload: unknown): PaperChoice {
  const raw = (payload as { paper?: unknown } | null | undefined)?.paper;

  if (typeof raw === "string") {
    const parsed = paperChoiceSchema.safeParse({ color: raw, pattern: "plain" });
    return parsed.success ? parsed.data : DEFAULT_PAPER;
  }
  const parsed = paperChoiceSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : DEFAULT_PAPER;
}
