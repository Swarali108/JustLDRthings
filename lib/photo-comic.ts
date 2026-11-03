import { z } from "zod";

/**
 * Photo-to-comic: your actual photographs, drawn as an illustrated comic.
 *
 * Replaces the SVG-avatar comic. The trade is explicit and worth writing down,
 * because the earlier design chose the opposite way for real reasons:
 *
 *   SVG avatars          →  free, instant, identical faces every panel,
 *                           renders offline, nothing leaves the browser,
 *                           but it looks like flat clip-art.
 *   Generated from photos→  looks like a real comic, but costs ~$0.04 an
 *                           image, takes ~30s, sends photos to Google, and
 *                           faces drift a little between panels.
 *
 * Two things keep the cost honest. The storyboard is written FIRST by a cheap
 * text model and shown for editing, so nobody pays for a drawing of a story
 * they did not want. And the image step is a separate request, so a redraw is
 * a deliberate act rather than a side effect of changing a word.
 */

export const ART_STYLES = [
  "warm-comic", "manga", "watercolor", "retro", "cute-cartoon", "ink"
] as const;
export type ArtStyle = (typeof ART_STYLES)[number];

export const ART_STYLE_LABELS: Record<ArtStyle, string> = {
  "warm-comic": "Warm comic",
  manga: "Manga",
  watercolor: "Watercolour",
  retro: "Retro print",
  "cute-cartoon": "Cute cartoon",
  ink: "Ink & wash"
};

/** The art direction handed to the image model. */
export const ART_STYLE_BRIEFS: Record<ArtStyle, string> = {
  "warm-comic":
    "Warm hand-illustrated comic-book art. Soft peach and blush backgrounds, expressive faces, clean black panel borders, gentle shading.",
  manga:
    "Black-and-white manga art. Screentone shading, clean linework, expressive large eyes, dynamic panel borders.",
  watercolor:
    "Soft watercolour storybook illustration. Visible paper texture, bleeding edges, muted pastel palette, delicate linework.",
  retro:
    "1960s retro print comic. Limited flat palette, visible halftone dots, bold outlines, slightly off-register colour.",
  "cute-cartoon":
    "Cute rounded cartoon style. Simple shapes, big friendly eyes, bright cheerful colours, thick clean outlines.",
  ink: "Ink and wash. Confident brush linework, grey washes, a single muted accent colour, lots of white space."
};

/** How closely the story must stick to what the photos actually show. */
export const FREEDOMS = ["grounded", "balanced", "invent"] as const;
export type Freedom = (typeof FREEDOMS)[number];

export const FREEDOM_LABELS: Record<Freedom, string> = {
  grounded: "Only what's in my photos",
  balanced: "Mostly real, a few additions",
  invent: "Invent freely around us"
};

export const FREEDOM_BRIEFS: Record<Freedom, string> = {
  grounded:
    "Every panel must depict something visible in the photographs or stated in the memory. Invent no events, places or objects.",
  balanced:
    "Base the panels on the photographs and the memory. You may add small connecting moments, but never a significant event they did not describe.",
  invent:
    "Use the photographs for who these people are and the memory for its tone, then tell a fuller story around them."
};

export const PANEL_COUNTS = [4, 6, 8] as const;
export type PanelCount = (typeof PANEL_COUNTS)[number];

/**
 * What one drawn panel costs, roughly, in US dollars.
 *
 * Observed, not quoted: a four-panel run billed $0.1559, and the model prices
 * image output per token at a flat rate for a 1024px image. Used only to show
 * the user a price BEFORE they commit to a draw — the real figure always comes
 * back from the API and is what gets added to the running total.
 */
export const APPROX_PANEL_COST_USD = 0.039;

export const MIN_PHOTOS = 2;
export const MAX_PHOTOS = 6;
/** Longest edge after client-side resizing, before upload. */
export const PHOTO_MAX_EDGE = 1024;
export const MAX_DIALOGUE_CHARS = 80;

// ---------------------------------------------------------------------------
// The storyboard (step 1 — cheap, editable)
// ---------------------------------------------------------------------------

export const storyPanelSchema = z.object({
  /** What is happening, for the illustrator. */
  scene: z.string().trim().min(3).max(220),
  /** Who is in it and what they are doing. */
  characters: z.string().trim().max(160).default(""),
  dialogue: z
    .array(
      z.object({
        speaker: z.enum(["A", "B", "narrator"]),
        text: z.string().trim().min(1).max(MAX_DIALOGUE_CHARS)
      })
    )
    .max(3)
    .default([]),
  caption: z.string().trim().max(70).optional(),
  /**
   * Which uploaded photo this panel draws on, by index. The model is told the
   * photos are numbered; keeping the link lets the UI show which memory each
   * panel came from, and tells the illustrator which face to use.
   */
  photo: z.number().int().min(0).max(MAX_PHOTOS - 1).nullable().default(null)
});

export const storyboardSchema = z.object({
  title: z.string().trim().min(1).max(60),
  panels: z.array(storyPanelSchema).min(2).max(8)
});

export type StoryPanel = z.infer<typeof storyPanelSchema>;
export type Storyboard = z.infer<typeof storyboardSchema>;

// ---------------------------------------------------------------------------
// The finished thing
// ---------------------------------------------------------------------------

/** Panel grid for a given count. The drawing is told to use exactly this. */
export function gridFor(panels: number): { cols: number; rows: number } {
  if (panels <= 2) return { cols: 2, rows: 1 };
  if (panels <= 4) return { cols: 2, rows: 2 };
  if (panels <= 6) return { cols: 2, rows: 3 };
  return { cols: 2, rows: 4 };
}

/**
 * Fold a partial draw into the panels already on the page.
 *
 * The API always answers with one slot per panel and leaves the ones it was not
 * asked to draw empty. Taking that array as-is would wipe every panel except
 * the one just redrawn — which is indistinguishable, to someone watching, from
 * the redraw doing nothing at all.
 *
 * Pure and separate from the component because this is the step where a
 * one-panel redraw either works or silently destroys the rest of the comic.
 */
export function mergePanels(previous: string[] | null, incoming: string[]): string[] {
  if (!previous) return incoming;
  const length = Math.max(previous.length, incoming.length);
  return Array.from({ length }, (_, i) => incoming[i] || previous[i] || "");
}

export const photoComicSchema = z.object({
  title: z.string().trim().min(1).max(60),
  storyboard: storyboardSchema,
  style: z.enum(ART_STYLES),
  /**
   * One drawn image per panel, in order. A data URI while it is a draft; a
   * signed storage url once saved. An empty string marks a panel that failed
   * to draw and can be redrawn on its own.
   */
  images: z.array(z.string().max(3_000_000)).max(8).default([])
});

export type PhotoComic = z.infer<typeof photoComicSchema>;

// ---------------------------------------------------------------------------
// The drawing instruction
// ---------------------------------------------------------------------------

/**
 * Turn the storyboard into one instruction for the image model.
 *
 * Built in code, not by the model, so the art direction, the layout rules and
 * the character-consistency demand are identical on every run. Only the story
 * changes.
 */
/**
 * The instruction for ONE panel.
 *
 * Panels are drawn individually and the grid is composed by the app. Asking for
 * a whole page in a given grid does not work: told "exactly 4 panels, 2 by 2,
 * no insets", the model returned 5 panels with a sub-panel and an outer margin,
 * twice. A text overlay positioned by quadrant cannot survive that.
 *
 * One panel per image makes the layout exact, so speech bubbles land where they
 * belong, and it means a single bad panel can be redrawn without paying for the
 * other three. The cost is one image per panel instead of one per comic, and
 * the risk is that the two people drift between separately-generated panels —
 * which is why every panel gets the same reference photographs.
 */
export function buildPanelPrompt(
  panel: StoryPanel,
  index: number,
  total: number,
  style: ArtStyle,
  names: { a: string; b: string },
  photoCount: number
): string {
  const A = names.a || "the first person";
  const B = names.b || "the second person";

  return `Draw ONE single comic panel. Not a page, not a grid — one rectangular panel, filling the whole image edge to edge.

SHAPE
A wide landscape panel, about 16:9. Compose for that shape: keep the faces and
the action near the middle, because the far left and right edges may be cropped.

STYLE
${ART_STYLE_BRIEFS[style]}

CHARACTERS
Two recurring people, taken from the ${photoCount} reference photographs supplied with this request.
Keep BOTH recognisably themselves: same face, same hair, same build, every time they appear.
They are called ${A} and ${B}.
This panel is number ${index + 1} of ${total} in one comic, so they must look identical to how they would look in the others.

THIS PANEL
${panel.scene}
${panel.characters ? `Who is in it: ${panel.characters}` : ""}
${panel.photo !== null ? `Use reference photo ${panel.photo + 1} for the faces.` : ""}
${panel.dialogue.length ? `The feeling, for the expressions — do NOT write these words: ${panel.dialogue.map((d) => d.text).join(" / ")}` : ""}

NO TEXT — THIS MATTERS MOST
Draw NO words anywhere. No speech bubbles, no caption boxes, no titles, no signatures, no sound effects, no writing on signs or screens.
The dialogue is added afterwards by the application.
Leave the upper third of the panel calm and uncluttered so a speech bubble can sit there.
A single letter of text anywhere is a failure.

FILL THE FRAME
The scene bleeds to all four edges of the image.
No border, no outline, no coloured margin, no empty bar at the top or bottom, no letterboxing.
Do not draw a comic panel. Draw only what is INSIDE one — the application supplies the border.
Never split this image into more than one scene.

DO NOT
Do not photo-collage the references. Draw original illustrations of these people.`;
}
