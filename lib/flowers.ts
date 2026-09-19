/**
 * The flowers you can put in a bouquet.
 *
 * Each carries a meaning from the Victorian language of flowers — that is the
 * point of the creator. Picking "forget-me-not" for someone far away says
 * something a generic blue circle does not, and the meaning is shown to the
 * recipient underneath the bouquet.
 *
 * `id` is what gets stored and what travels in a guest link, so it is a closed
 * set and the labels/colours are looked up from it at render time. Renaming an
 * id would orphan every link already sent; add new ones instead.
 */
export interface Flower {
  id: string;
  label: string;
  meaning: string;
  /** Petal colour, and a slightly deeper tone for the inner shadow. */
  color: string;
}

export const FLOWERS: Flower[] = [
  { id: "rose", label: "Rose", meaning: "deep love", color: "#c2415f" },
  { id: "forgetmenot", label: "Forget-me-not", meaning: "true love, remembrance", color: "#6d9bd1" },
  { id: "tulip", label: "Tulip", meaning: "a declaration", color: "#e0736a" },
  { id: "peony", label: "Peony", meaning: "a happy life together", color: "#eaa1b8" },
  { id: "lavender", label: "Lavender", meaning: "devotion", color: "#9b8ac4" },
  { id: "daisy", label: "Daisy", meaning: "loyal love", color: "#f2e7c9" },
  { id: "sunflower", label: "Sunflower", meaning: "adoration", color: "#e8b53d" },
  { id: "hydrangea", label: "Hydrangea", meaning: "gratitude", color: "#8fb8d9" },
  { id: "camellia", label: "Camellia", meaning: "you're always on my mind", color: "#d76a93" },
  { id: "jasmine", label: "Jasmine", meaning: "sweetness, longing", color: "#f6f1e4" },
  { id: "poppy", label: "Poppy", meaning: "consolation, rest", color: "#d64545" },
  { id: "bluebell", label: "Bluebell", meaning: "constancy", color: "#7b7fd4" }
];

export const FLOWER_BY_ID: Record<string, Flower> = FLOWERS.reduce(
  (acc, f) => {
    acc[f.id] = f;
    return acc;
  },
  {} as Record<string, Flower>
);

export const FLOWER_IDS = FLOWERS.map((f) => f.id) as [string, ...string[]];

export const MAX_STEMS = 9;

/** Unique meanings for the picked stems, in pick order, for the caption line. */
export function bouquetMeanings(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const flower = FLOWER_BY_ID[id];
    if (flower && !seen.has(flower.meaning)) {
      seen.add(flower.meaning);
      out.push(flower.meaning);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// The rest of the bouquet: greenery, wrapping paper, ribbon.
//
// Same closed-set rule as FLOWERS — these ids travel in a guest link and become
// colours and class names, so they are looked up, never interpolated raw.
// ---------------------------------------------------------------------------

export interface Greenery {
  id: string;
  label: string;
  meaning: string;
  color: string;
  /** How the sprig is drawn: a leafy stem, a frond, or a spray of tiny buds. */
  shape: "leaf" | "frond" | "spray";
}

export const GREENERY: Greenery[] = [
  { id: "eucalyptus", label: "Eucalyptus", meaning: "protection", color: "#8ba888", shape: "leaf" },
  { id: "fern", label: "Fern", meaning: "sincerity", color: "#5f7f5a", shape: "frond" },
  { id: "ivy", label: "Ivy", meaning: "holding on", color: "#4f6b46", shape: "leaf" },
  { id: "babysbreath", label: "Baby's breath", meaning: "everlasting", color: "#f3efe6", shape: "spray" },
  { id: "olive", label: "Olive branch", meaning: "peace", color: "#7d8b5f", shape: "frond" },
  { id: "wheat", label: "Wheat", meaning: "abundance", color: "#c9a961", shape: "spray" }
];

export const GREENERY_BY_ID: Record<string, Greenery> = GREENERY.reduce(
  (acc, g) => {
    acc[g.id] = g;
    return acc;
  },
  {} as Record<string, Greenery>
);

export const GREENERY_IDS = GREENERY.map((g) => g.id) as [string, ...string[]];
export const MAX_GREENERY = 6;

export interface Wrap {
  id: string;
  label: string;
  /** CSS background for the cone. Literal values so the keepsake can reuse them. */
  background: string;
  ink: string;
}

export const WRAPS: Wrap[] = [
  {
    id: "kraft",
    label: "Brown kraft",
    background: "repeating-linear-gradient(110deg, rgba(120,85,50,.10) 0 12px, #d8bc95 13px 26px)",
    ink: "#5a4228"
  },
  {
    id: "lace",
    label: "Lace",
    background: "radial-gradient(circle at 6px 6px, rgba(140,101,124,.18) 2px, transparent 3px) 0 0/14px 14px, #fcfaf8",
    ink: "#6a2147"
  },
  {
    id: "tissue",
    label: "Pink tissue",
    background: "linear-gradient(135deg, #f7dfe4 0%, #f2c9d3 50%, #f7dfe4 100%)",
    ink: "#8c3a58"
  },
  {
    id: "news",
    label: "Newspaper",
    background: "repeating-linear-gradient(0deg, rgba(40,40,40,.16) 0 1px, transparent 1px 5px), #efe9dd",
    ink: "#2f2f2f"
  },
  {
    id: "cream",
    label: "Plain cream",
    background: "repeating-linear-gradient(110deg, rgba(106,33,71,.08) 0 12px, rgba(252,250,248,.95) 13px 26px), #f7f3ef",
    ink: "#6a2147"
  },
  {
    id: "plum",
    label: "Plum satin",
    background: "linear-gradient(135deg, #5c2340 0%, #7d3157 45%, #4a1b33 100%)",
    ink: "#f4e9d8"
  }
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
}

export const RIBBONS: Ribbon[] = [
  { id: "none", label: "No ribbon", color: "transparent" },
  { id: "cream", label: "Cream", color: "#e8dcc8" },
  { id: "blush", label: "Blush", color: "#e3a7b5" },
  { id: "sage", label: "Sage", color: "#a3b89b" },
  { id: "plum", label: "Plum", color: "#6a2147" },
  { id: "gold", label: "Gold", color: "#d4af62" }
];

export const RIBBON_BY_ID: Record<string, Ribbon> = RIBBONS.reduce(
  (acc, r) => {
    acc[r.id] = r;
    return acc;
  },
  {} as Record<string, Ribbon>
);

export const RIBBON_IDS = RIBBONS.map((r) => r.id) as [string, ...string[]];

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
