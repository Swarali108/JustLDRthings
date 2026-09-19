/**
 * The bouquet: flowers, filler leaves, wrapping.
 *
 * Every id is a closed set — these travel in a guest link and become colours and
 * class names, so they are looked up, never interpolated raw. Renaming an id
 * orphans every link already sent; only ever add.
 *
 * Flowers are drawn as SVG from a small spec (petal count, shape, colours)
 * rather than shipped as images: a bouquet then costs a handful of ids in a link
 * instead of megabytes of artwork, and it stays sharp at any size and in print.
 */

export type PetalShape = "round" | "pointed" | "narrow" | "star" | "ruffled" | "rosette";

export interface Flower {
  id: string;
  label: string;
  meaning: string;
  /** Outer petal colour. */
  color: string;
  /** Inner petal wash, blended toward the centre. */
  inner: string;
  /** The eye of the flower. */
  center: string;
  petals: number;
  shape: PetalShape;
}

/** The fifteen blooms, matching the reference sheet. */
export const FLOWERS: Flower[] = [
  { id: "cosmos-pink",  label: "Pink cosmos",   meaning: "a peaceful love",        color: "#f0aec4", inner: "#fdf0f4", center: "#e8b53d", petals: 5,  shape: "round" },
  { id: "daisy-white",  label: "White daisy",   meaning: "loyal love",             color: "#fcfaf8", inner: "#eef2f7", center: "#e8b53d", petals: 11, shape: "narrow" },
  { id: "anemone",      label: "Anemone",       meaning: "anticipation",           color: "#8b86cf", inner: "#b6b2e0", center: "#3b2f4a", petals: 6,  shape: "round" },
  { id: "cosmos-coral", label: "Coral cosmos",  meaning: "warmth",                 color: "#e08276", inner: "#f3c4bd", center: "#a8823e", petals: 8,  shape: "pointed" },
  { id: "plumeria",     label: "Plumeria",      meaning: "new beginnings",         color: "#f2569b", inner: "#fbc16a", center: "#f7d488", petals: 5,  shape: "ruffled" },
  { id: "sunflower",    label: "Sunflower",     meaning: "adoration",              color: "#f0b429", inner: "#f7d06a", center: "#5b4420", petals: 16, shape: "pointed" },
  { id: "hibiscus-ice", label: "Ice hibiscus",  meaning: "delicate beauty",        color: "#c8d6e8", inner: "#fcfaf8", center: "#7f93ad", petals: 6,  shape: "ruffled" },
  { id: "cornflower",   label: "Cornflower",    meaning: "hope in waiting",        color: "#3f61ab", inner: "#8fa8d8", center: "#e08a3c", petals: 7,  shape: "round" },
  { id: "wildrose",     label: "Wild rose",     meaning: "a love that endures",    color: "#e2515f", inner: "#f4a0a0", center: "#efd06a", petals: 6,  shape: "round" },
  { id: "gerbera-gold", label: "Gold gerbera",  meaning: "cheerfulness",           color: "#e0a02a", inner: "#eec758", center: "#8a5a1c", petals: 14, shape: "narrow" },
  { id: "forgetmenot",  label: "Forget-me-not", meaning: "true love, remembrance", color: "#a9d2ef", inner: "#e4f2fb", center: "#f6f0d8", petals: 5,  shape: "round" },
  { id: "starflower",   label: "Star flower",   meaning: "a wish kept",            color: "#ee8b3f", inner: "#f6c07a", center: "#c66a26", petals: 7,  shape: "star" },
  { id: "succulent",    label: "Succulent",     meaning: "steady, enduring",       color: "#7fae95", inner: "#a9c9b2", center: "#5d8a72", petals: 9,  shape: "rosette" },
  { id: "plumbago",     label: "Plumbago",      meaning: "quiet affection",        color: "#8f9fe0", inner: "#c6cdf2", center: "#f0f2fb", petals: 5,  shape: "round" },
  { id: "osteospermum", label: "Lilac daisy",   meaning: "a fresh start",          color: "#c3a7d9", inner: "#e6d9f0", center: "#4a3357", petals: 13, shape: "narrow" }
];

export const FLOWER_BY_ID: Record<string, Flower> = FLOWERS.reduce(
  (acc, f) => {
    acc[f.id] = f;
    return acc;
  },
  {} as Record<string, Flower>
);

export const FLOWER_IDS = FLOWERS.map((f) => f.id) as [string, ...string[]];

/** Per the brief: fifteen stems in a bouquet, and up to fifteen of any one. */
export const MAX_STEMS = 15;
export const MAX_PER_FLOWER = 15;

// ---------------------------------------------------------------------------
// Filler leaves
// ---------------------------------------------------------------------------

export type LeafShape = "sprig" | "round" | "seeded" | "willow" | "broad";

export interface Greenery {
  id: string;
  label: string;
  meaning: string;
  color: string;
  /** Second tone, for the leaves further along the stem. */
  tone: string;
  shape: LeafShape;
  /** Leaf pairs along the stem. */
  leaves: number;
}

export const GREENERY: Greenery[] = [
  { id: "olive",       label: "Olive",         meaning: "peace",          color: "#9aa870", tone: "#b4bf8c", shape: "sprig",  leaves: 6 },
  { id: "eucalyptus",  label: "Eucalyptus",    meaning: "protection",     color: "#5f7f6b", tone: "#7d9b88", shape: "round",  leaves: 7 },
  { id: "bay",         label: "Bay laurel",    meaning: "steadfastness",  color: "#7c9270", tone: "#96a988", shape: "sprig",  leaves: 5 },
  { id: "magnolia",    label: "Magnolia leaf", meaning: "dignity",        color: "#5c7f55", tone: "#7fa073", shape: "broad",  leaves: 4 },
  { id: "babyeuc",     label: "Baby eucalypt", meaning: "everlasting",    color: "#8fae8c", tone: "#aec7a9", shape: "round",  leaves: 8 },
  { id: "autumnleaf",  label: "Autumn branch", meaning: "time together",  color: "#c08d4d", tone: "#d8ab6e", shape: "sprig",  leaves: 6 },
  { id: "budsprig",    label: "Bud sprig",     meaning: "something new",  color: "#a9bf95", tone: "#c3d4b2", shape: "seeded", leaves: 10 },
  { id: "silverdollar",label: "Silver dollar", meaning: "constancy",      color: "#8aa3a8", tone: "#a9bec2", shape: "round",  leaves: 6 },
  { id: "ruscus",      label: "Ruscus",        meaning: "quiet strength", color: "#3f5f41", tone: "#5a7d5c", shape: "sprig",  leaves: 9 },
  { id: "laurelbroad", label: "Broad laurel",  meaning: "honour",         color: "#6d8f5f", tone: "#8aa87a", shape: "broad",  leaves: 3 },
  { id: "seededeuc",   label: "Seeded eucalypt", meaning: "abundance",    color: "#7d9482", tone: "#9db0a1", shape: "seeded", leaves: 9 },
  { id: "willow",      label: "Willow",        meaning: "gentleness",     color: "#6f8a63", tone: "#8fa683", shape: "willow", leaves: 8 }
];

export const GREENERY_BY_ID: Record<string, Greenery> = GREENERY.reduce(
  (acc, g) => {
    acc[g.id] = g;
    return acc;
  },
  {} as Record<string, Greenery>
);

export const GREENERY_IDS = GREENERY.map((g) => g.id) as [string, ...string[]];

/** Per the brief: twelve filler leaves per bouquet. */
export const MAX_GREENERY = 12;
export const MAX_PER_LEAF = 12;

// ---------------------------------------------------------------------------
// Wrapping and ribbon
// ---------------------------------------------------------------------------

export interface Wrap {
  id: string;
  label: string;
  /** Front face of the folded cone. */
  front: string;
  /** The turned-back collar, a shade darker. */
  fold: string;
  ink: string;
}

export const WRAPS: Wrap[] = [
  { id: "peach",  label: "Peach kraft", front: "#f3d9c4", fold: "#e5c0a5", ink: "#7a5237" },
  { id: "cream",  label: "Soft cream",  front: "#f6efe4", fold: "#e7dac7", ink: "#6a5540" },
  { id: "blush",  label: "Blush",       front: "#f5d8dc", fold: "#e8bcc4", ink: "#8c3a58" },
  { id: "sage",   label: "Sage",        front: "#dbe5d6", fold: "#c2d2bd", ink: "#4f6b46" },
  { id: "kraft",  label: "Brown kraft", front: "#dcbd96", fold: "#c6a179", ink: "#5a4228" },
  { id: "plum",   label: "Plum satin",  front: "#7d3157", fold: "#5c2340", ink: "#f4e9d8" },
  { id: "mist",   label: "Powder blue", front: "#d8e3ef", fold: "#bdcee0", ink: "#356a89" },
  { id: "noir",   label: "Charcoal",    front: "#4a4a52", fold: "#35353c", ink: "#f0ece6" }
];

export const WRAP_BY_ID: Record<string, Wrap> = WRAPS.reduce(
  (acc, w) => {
    acc[w.id] = w;
    return acc;
  },
  {} as Record<string, Wrap>
);

export const WRAP_IDS = WRAPS.map((w) => w.id) as [string, ...string[]];

export interface Ribbon {
  id: string;
  label: string;
  color: string;
  shade: string;
}

export const RIBBONS: Ribbon[] = [
  { id: "none",  label: "No ribbon", color: "transparent", shade: "transparent" },
  { id: "peach", label: "Peach",     color: "#e8b198", shade: "#d1937a" },
  { id: "cream", label: "Cream",     color: "#e8dcc8", shade: "#cfc0a8" },
  { id: "blush", label: "Blush",     color: "#e3a7b5", shade: "#c98a9a" },
  { id: "sage",  label: "Sage",      color: "#a3b89b", shade: "#87a07e" },
  { id: "plum",  label: "Plum",      color: "#6a2147", shade: "#4d1633" },
  { id: "gold",  label: "Gold",      color: "#d4af62", shade: "#b8934a" }
];

export const RIBBON_BY_ID: Record<string, Ribbon> = RIBBONS.reduce(
  (acc, r) => {
    acc[r.id] = r;
    return acc;
  },
  {} as Record<string, Ribbon>
);

export const RIBBON_IDS = RIBBONS.map((r) => r.id) as [string, ...string[]];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Count how many of each id appear, for the +/- steppers. */
export function countOf(list: string[], id: string): number {
  let n = 0;
  for (const item of list) if (item === id) n++;
  return n;
}

/** Add one, respecting both the per-kind cap and the bouquet total. */
export function addOne(list: string[], id: string, perKind: number, total: number): string[] {
  if (list.length >= total) return list;
  if (countOf(list, id) >= perKind) return list;
  return [...list, id];
}

/** Remove the last of that id. */
export function removeOne(list: string[], id: string): string[] {
  const idx = list.lastIndexOf(id);
  if (idx === -1) return list;
  return list.filter((_, i) => i !== idx);
}

/** Meanings for flowers AND greenery, de-duplicated, in pick order. */
export function arrangementMeanings(stems: string[], greenery: string[] = []): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of stems) {
    const f = FLOWER_BY_ID[id];
    if (f && !seen.has(f.meaning)) {
      seen.add(f.meaning);
      out.push(f.meaning);
    }
  }
  for (const id of greenery) {
    const g = GREENERY_BY_ID[id];
    if (g && !seen.has(g.meaning)) {
      seen.add(g.meaning);
      out.push(g.meaning);
    }
  }
  return out;
}
