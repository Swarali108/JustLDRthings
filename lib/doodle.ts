import { z } from "zod";

/**
 * A doodle is stored as strokes, not as an image.
 *
 * The obvious implementation is a canvas exported to a PNG data URI — and that
 * would immediately put doodle in the same bucket as photos: too big for a URL,
 * download-only for guests. Storing the *path* instead keeps a drawing at a few
 * hundred bytes, so a doodle stays shareable by link like a note is.
 *
 * Every coordinate is an integer in a fixed 1000x700 box. Integers because
 * JSON.stringify writes "412" not "412.38194", which is roughly a third of the
 * characters, and because deflate compresses repeated short digit runs well.
 * The box is unitless, so the drawing scales to whatever width it is shown at.
 */

export const DOODLE_W = 1000;
export const DOODLE_H = 700;

/** Ink colours, indexed — a stroke stores `c: 3`, never a hex string. */
export const INKS = [
  "#211622", // ink
  "#6a2147", // burgundy
  "#c2415f", // rose
  "#e0736a", // coral
  "#e8b53d", // gold
  "#5f7f5a", // fern
  "#356a89", // ocean
  "#7b7fd4", // bluebell
  "#8c657c", // mauve
  "#fcfaf8" // chalk (for dark papers)
] as const;

/** Nib widths, indexed the same way. */
export const NIBS = [3, 6, 12, 22] as const;

export const MAX_STROKES = 120;
export const MAX_POINTS_PER_STROKE = 400;

/** Roughly the point past which a doodle stops fitting comfortably in a link. */
export const DOODLE_LINK_BUDGET = 6000;

const strokeSchema = z.object({
  /** Index into INKS. */
  c: z.number().int().min(0).max(INKS.length - 1),
  /** Index into NIBS. */
  w: z.number().int().min(0).max(NIBS.length - 1),
  /** Flat [x,y,x,y,…] in the 1000x700 box. Flat, not pairs — half the brackets. */
  p: z
    .array(z.number().int().min(-50).max(1100))
    .min(2)
    .max(MAX_POINTS_PER_STROKE * 2)
    .refine((points) => points.length % 2 === 0, "points must be x/y pairs")
});

export const doodleSchema = z.object({
  strokes: z.array(strokeSchema).min(1, "Draw something first.").max(MAX_STROKES),
  /** Paper colour behind the drawing, indexed into PAPERS. */
  paper: z.number().int().min(0).max(5).default(0)
});

export type DoodleStroke = z.infer<typeof strokeSchema>;
export type Doodle = z.infer<typeof doodleSchema>;

/** Paper tints the drawing sits on. */
export const PAPERS = [
  { label: "Cream", color: "#f7f3ef" },
  { label: "White", color: "#fcfaf8" },
  { label: "Blush", color: "#f7e7ea" },
  { label: "Powder", color: "#e7eef7" },
  { label: "Sage", color: "#e6ece2" },
  { label: "Plum", color: "#43182c" }
] as const;

/**
 * An SVG path for one stroke.
 *
 * A single point becomes a dot (a zero-length line with a round cap), which is
 * what a tap should produce — without this, tapping draws nothing.
 */
export function strokePath(stroke: DoodleStroke): string {
  const p = stroke.p;
  if (p.length === 2) return `M ${p[0]} ${p[1]} L ${p[0]} ${p[1]}`;

  let d = `M ${p[0]} ${p[1]}`;
  for (let i = 2; i < p.length; i += 2) d += ` L ${p[i]} ${p[i + 1]}`;
  return d;
}

export function inkColor(index: number): string {
  return INKS[index] ?? INKS[0];
}

export function nibWidth(index: number): number {
  return NIBS[index] ?? NIBS[1];
}

export function paperColor(index: number): string {
  return PAPERS[index]?.color ?? PAPERS[0].color;
}

/**
 * Drop points that are visually indistinguishable from the previous one.
 *
 * A pointer event fires far more often than a drawing needs; without this a
 * short line is hundreds of near-identical coordinates. Dropping anything within
 * `tolerance` of the last kept point typically removes 60-80% of them with no
 * visible change, which is the difference between a doodle that fits in a link
 * and one that does not.
 */
export function simplify(points: number[], tolerance = 4): number[] {
  if (points.length <= 4) return points;

  const out = [points[0], points[1]];
  for (let i = 2; i < points.length - 2; i += 2) {
    const dx = points[i] - out[out.length - 2];
    const dy = points[i + 1] - out[out.length - 1];
    if (dx * dx + dy * dy >= tolerance * tolerance) {
      out.push(points[i], points[i + 1]);
    }
  }
  // Always keep the final point so the stroke ends where the finger lifted.
  out.push(points[points.length - 2], points[points.length - 1]);
  return out;
}

/** Rough size of the encoded doodle, for warning before the link gets unwieldy. */
export function doodleWeight(doodle: Doodle): number {
  return JSON.stringify(doodle).length;
}
