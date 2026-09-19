import { z } from "zod";

/**
 * How a creation is dressed: colour, lettering, placement, and decorations.
 *
 * Stored inside `payload_json.style` rather than in its own column, so adding or
 * changing an option never needs a migration. It is a handful of short strings,
 * which is also why it rides along in a guest link for almost no characters.
 *
 * Everything here is a closed set, never free text. A guest link is authored by
 * whoever sends it, and these values become CSS class names and rendered glyphs
 * — an allow-list is what keeps that from being someone else's input.
 */

export const THEMES = ["classic", "midnight", "seaside", "pressed", "polaroid"] as const;
export const FONTS = ["serif", "script", "sans", "type"] as const;
export const ALIGNS = ["left", "center", "right"] as const;

/** Curated decorations. Emoji render in colour everywhere and need no font file. */
export const STICKERS = [
  "🌸", "💐", "🌷", "🌿", "🦋", "✨", "💌", "🎀",
  "⭐", "🌙", "💕", "🍓", "☕", "📷", "🕊️", "🫧"
] as const;

export const MAX_STICKERS = 6;

export type Theme = (typeof THEMES)[number];
export type Sticker = (typeof STICKERS)[number];
export type Font = (typeof FONTS)[number];
export type Align = (typeof ALIGNS)[number];

export const styleSchema = z.object({
  theme: z.enum(THEMES).default("classic"),
  font: z.enum(FONTS).default("serif"),
  align: z.enum(ALIGNS).default("left"),
  tilt: z.coerce.number().int().min(-3).max(3).default(0),
  stickers: z
    .array(z.enum(STICKERS))
    .max(MAX_STICKERS)
    .default([])
    // A repeated sticker is harmless but looks like a mistake; collapse it.
    .transform((list) => Array.from(new Set(list)))
});

/**
 * Derived from the schema rather than declared alongside it, so the runtime
 * check and the compile-time type can never disagree — the same reasoning that
 * put every other validated shape in `lib/validation.ts` behind `z.infer`.
 */
export type ItemStyle = z.infer<typeof styleSchema>;

export const DEFAULT_STYLE: ItemStyle = {
  theme: "classic",
  font: "serif",
  align: "left",
  tilt: 0,
  stickers: []
};

/** Human labels for the picker. Kept next to the values so they can't drift. */
export const THEME_LABELS: Record<Theme, string> = {
  classic: "Classic cream",
  midnight: "Midnight plum",
  seaside: "Seaside blue",
  pressed: "Pressed flowers",
  polaroid: "Photo album"
};

export const FONT_LABELS: Record<Font, string> = {
  serif: "Storybook",
  script: "Handwritten",
  sans: "Clean",
  type: "Typewriter"
};

export const ALIGN_LABELS: Record<Align, string> = {
  left: "Left",
  center: "Centred",
  right: "Right"
};

/** Read a style back off a payload, filling in anything missing or invalid. */
export function readStyle(payload: unknown): ItemStyle {
  const raw = (payload as { style?: unknown } | null | undefined)?.style;
  const parsed = styleSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : DEFAULT_STYLE;
}

/** The class list a styled block carries in the app. */
export function styleClasses(style: ItemStyle): string {
  return `sty theme-${style.theme} font-${style.font} align-${style.align}`;
}

/**
 * Inline transform for the tilt. Kept out of CSS because it is a free number
 * rather than one of a few classes, and a tilt of 0 should emit nothing at all.
 */
export function tiltStyle(style: ItemStyle): { transform?: string } {
  return style.tilt ? { transform: `rotate(${style.tilt}deg)` } : {};
}

// ---- keepsake (offline HTML) ---------------------------------------------

/**
 * Font stacks for the downloaded file.
 *
 * The app can use Caveat and Cormorant Garamond because it loads them from
 * Google Fonts. The keepsake must open on a laptop with no network, so every
 * choice here resolves to something already on the machine.
 */
export const KEEPSAKE_FONTS: Record<Font, string> = {
  serif: 'ui-serif, Georgia, "Times New Roman", serif',
  script: '"Segoe Script", "Bradley Hand", "Snell Roundhand", cursive',
  sans: 'ui-sans-serif, system-ui, "Segoe UI", Helvetica, Arial, sans-serif',
  type: 'ui-monospace, "Courier New", Courier, monospace'
};

export interface KeepsakePalette {
  pageBg: string;
  cardBg: string;
  ink: string;
  accent: string;
  border: string;
}

export const KEEPSAKE_PALETTES: Record<Theme, KeepsakePalette> = {
  classic: {
    pageBg: "linear-gradient(180deg,#e7eef7 0%,#f7f3ef 55%,#f7f3ef 100%)",
    cardBg: "#fcfaf8",
    ink: "#211622",
    accent: "#6a2147",
    border: "rgba(140,101,124,.35)"
  },
  midnight: {
    pageBg: "linear-gradient(180deg,#2d1525 0%,#43182c 60%,#521b38 100%)",
    cardBg: "rgba(252,250,248,.07)",
    ink: "#f4e9d8",
    accent: "#e0b973",
    border: "rgba(224,185,115,.45)"
  },
  seaside: {
    pageBg: "linear-gradient(180deg,#cfddec 0%,#e7eef7 60%,#fcfaf8 100%)",
    cardBg: "rgba(252,250,248,.92)",
    ink: "#1d2f3d",
    accent: "#356a89",
    border: "rgba(53,106,137,.3)"
  },
  pressed: {
    pageBg: "linear-gradient(180deg,#f2ece2 0%,#f7f3ef 100%)",
    cardBg: "#fbf7ee",
    ink: "#3a3026",
    accent: "#7a6a4f",
    border: "rgba(122,106,79,.4)"
  },
  polaroid: {
    pageBg: "#e9e4dd",
    cardBg: "#ffffff",
    ink: "#2b2b2b",
    accent: "#6a2147",
    border: "rgba(0,0,0,.12)"
  }
};

// ---------------------------------------------------------------------------
// Presets: one tap that sets colour, lettering, placement and tilt together.
//
// The individual controls stay — these are a starting point, not a replacement.
// Most people want "make it look nice" rather than five separate decisions, and
// a preset is just a stored ItemStyle, so nothing new has to be validated or
// encoded: picking one is identical to setting the four controls by hand.
// ---------------------------------------------------------------------------

export interface StylePreset {
  id: string;
  label: string;
  style: ItemStyle;
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "loveletter",
    label: "Love letter",
    style: { theme: "classic", font: "script", align: "left", tilt: -1, stickers: ["💌", "🌸"] }
  },
  {
    id: "midnight",
    label: "Midnight",
    style: { theme: "midnight", font: "serif", align: "center", tilt: 0, stickers: ["🌙", "⭐"] }
  },
  {
    id: "postcard",
    label: "Postcard",
    style: { theme: "seaside", font: "type", align: "left", tilt: 1, stickers: ["🕊️"] }
  },
  {
    id: "pressed",
    label: "Pressed flowers",
    style: { theme: "pressed", font: "serif", align: "center", tilt: -2, stickers: ["🌿", "🦋"] }
  },
  {
    id: "polaroid",
    label: "Pinned photo",
    style: { theme: "polaroid", font: "sans", align: "center", tilt: 2, stickers: ["📷"] }
  },
  {
    id: "sweet",
    label: "Sweet & simple",
    style: { theme: "classic", font: "sans", align: "center", tilt: 0, stickers: ["💕"] }
  }
];

/** Does the current style match a preset exactly? Used to light up the chip. */
export function matchingPreset(style: ItemStyle): string | null {
  const key = (s: ItemStyle) =>
    `${s.theme}|${s.font}|${s.align}|${s.tilt}|${[...s.stickers].sort().join("")}`;
  const mine = key(style);
  return STYLE_PRESETS.find((p) => key(p.style) === mine)?.id ?? null;
}
