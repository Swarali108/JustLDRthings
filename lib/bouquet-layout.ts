/**
 * Where every stem in a bouquet sits.
 *
 * A real bouquet is radial, not a row: every stem converges on one tie point,
 * the heads fan into a dome, and the greenery reaches higher and wider behind.
 * Laying flowers out in a line — which is what this did first — reads as a row
 * of stickers no matter how the individual blooms are drawn.
 *
 * Kept in `lib/` rather than in the component because the downloaded keepsake
 * builds its own HTML by hand and must place everything identically. One set of
 * numbers, two renderers.
 */

export const BQ = {
  width: 400,
  height: 560,
  /** Where every stem meets. */
  tieX: 200,
  tieY: 392,
  flowerReach: 172,
  greenReach: 232,
  /** Half-angle of the fan, in degrees. */
  flowerSpread: 52,
  greenSpread: 70
} as const;

export interface Placed {
  id: string;
  /** Head position. */
  x: number;
  y: number;
  /** Degrees from vertical; negative leans left. */
  angle: number;
  /** Distance from the tie. */
  reach: number;
  /** Render size for a bloom. */
  size: number;
  /** Draw order depth: lower items sit behind. */
  depth: number;
}

/**
 * Fan `n` items around the tie.
 *
 * `t` runs -1 (far left) to 1 (far right). Reach shortens with t² so the heads
 * describe a dome rather than a straight line — that curve is what makes the
 * silhouette read as a bouquet.
 *
 * Depth alternates so the cluster overlaps instead of sitting in one plane, but
 * reach deliberately does NOT: an alternating reach lands on the centre stem and
 * makes the apex of the dome sag.
 */
export function fanOut(ids: string[], spread: number, reach: number, sizeBase = 0): Placed[] {
  const n = ids.length;

  return ids.map((id, i) => {
    const t = n === 1 ? 0 : (i - (n - 1) / 2) / ((n - 1) / 2);

    // Reach is a pure function of t, with no per-item stagger. An alternating
    // stagger reads as natural variation everywhere EXCEPT the apex, where it
    // lands on the centre stem and makes the top of the dome sag. Variation
    // comes from head size and draw order instead, which cannot do that.
    const r = reach * (1 - 0.3 * t * t);

    // A degree of lean either side, so the bunch looks gathered by hand rather
    // than plotted. Too small to disturb the silhouette.
    const jitter = n === 1 ? 0 : i % 2 === 0 ? 1.5 : -1.5;
    const angle = t * spread + jitter;
    const rad = (angle * Math.PI) / 180;

    return {
      id,
      angle,
      reach: r,
      x: BQ.tieX + Math.sin(rad) * r,
      y: BQ.tieY - Math.cos(rad) * r,
      size: sizeBase ? sizeBase * (i % 3 === 0 ? 1 : i % 3 === 1 ? 0.86 : 0.94) : 0,
      depth: i % 2 === 0 ? 1 : 0
    };
  });
}

/**
 * Interleave so the fan reads outside-in.
 *
 * Picked in list order, stems would stack left-to-right and the last flower
 * chosen would always sit on the right edge. Alternating ends means adding one
 * more grows the bouquet symmetrically, which is how a bunch is actually built.
 */
export function balanced<T>(items: T[]): T[] {
  const out: T[] = [];
  items.forEach((item, i) => {
    if (i % 2 === 0) out.push(item);
    else out.unshift(item);
  });
  return out;
}

/** One petal of wrapping paper, as a path in tie-local coordinates (up is -y). */
export function wrapPetal(length: number, halfWidth: number): string {
  const w = halfWidth;
  const l = length;
  return (
    `M 0 0 ` +
    `C ${-w * 0.55} ${-l * 0.3}, ${-w} ${-l * 0.62}, ${-w * 0.42} ${-l * 0.94} ` +
    `Q 0 ${-l * 1.06}, ${w * 0.42} ${-l * 0.94} ` +
    `C ${w} ${-l * 0.62}, ${w * 0.55} ${-l * 0.3}, 0 0 Z`
  );
}

/** The paper layers: wide ones behind the stems, narrower ones folded in front. */
export const WRAP_LAYERS = {
  back: [
    { angle: -46, length: 210, halfWidth: 96, opacity: 0.55 },
    { angle: 46, length: 210, halfWidth: 96, opacity: 0.55 },
    { angle: -18, length: 232, halfWidth: 86, opacity: 0.45 },
    { angle: 18, length: 232, halfWidth: 86, opacity: 0.45 }
  ],
  front: [
    { angle: -30, length: 150, halfWidth: 78, opacity: 0.85 },
    { angle: 30, length: 150, halfWidth: 78, opacity: 0.85 },
    { angle: 0, length: 126, halfWidth: 66, opacity: 0.95 }
  ]
} as const;

/** Stem ends poking out below the tie. */
export const STEM_TAILS = [-13, -5, 3, 11, 18] as const;
