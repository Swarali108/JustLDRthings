import { z } from "zod";

/**
 * The two characters a comic is drawn with.
 *
 * Built once from presets rather than generated as images. Generated art gives
 * you two people who look different in every panel, costs money per picture and
 * takes seconds each; a small set of choices rendered as SVG gives the same two
 * faces every time, instantly and for nothing.
 *
 * Every value is a closed set, as everywhere else: these become fills and class
 * names, and a comic can arrive from a guest link written by whoever sent it.
 */

export const SKIN_TONES = [
  { id: "porcelain", label: "Porcelain", fill: "#f6ddcd", shade: "#e3c0ab" },
  { id: "sand", label: "Sand", fill: "#f0cda8", shade: "#dbb088" },
  { id: "honey", label: "Honey", fill: "#e0ac7a", shade: "#c68e5d" },
  { id: "almond", label: "Almond", fill: "#c88a5a", shade: "#a96e42" },
  { id: "umber", label: "Umber", fill: "#9c6239", shade: "#7d4b2a" },
  { id: "espresso", label: "Espresso", fill: "#6b4028", shade: "#51301d" }
] as const;

export const HAIR_STYLES = [
  "short", "long", "bun", "curly", "ponytail", "buzz", "bob", "wavy"
] as const;

export const HAIR_COLORS = [
  { id: "black", label: "Black", fill: "#241c1a" },
  { id: "darkbrown", label: "Dark brown", fill: "#43291a" },
  { id: "brown", label: "Brown", fill: "#6b4327" },
  { id: "auburn", label: "Auburn", fill: "#8c3b24" },
  { id: "blonde", label: "Blonde", fill: "#d4a55a" },
  { id: "grey", label: "Grey", fill: "#9a9a9a" },
  { id: "plum", label: "Plum", fill: "#6a2147" },
  { id: "teal", label: "Teal", fill: "#2f6b6b" }
] as const;

export const OUTFIT_COLORS = [
  { id: "plum", label: "Plum", fill: "#6a2147", shade: "#4d1633" },
  { id: "ocean", label: "Ocean", fill: "#356a89", shade: "#285068" },
  { id: "sage", label: "Sage", fill: "#6f8a63", shade: "#55694b" },
  { id: "mustard", label: "Mustard", fill: "#d2a03c", shade: "#a87c28" },
  { id: "rose", label: "Rose", fill: "#d4788f", shade: "#b25a70" },
  { id: "charcoal", label: "Charcoal", fill: "#3f4149", shade: "#2b2d33" },
  { id: "cream", label: "Cream", fill: "#e8dcc8", shade: "#cbbda3" },
  { id: "rust", label: "Rust", fill: "#b35a38", shade: "#8e4428" }
] as const;

export const ACCESSORIES = ["none", "glasses", "sunglasses", "earrings", "cap", "scarf", "headphones"] as const;

export type SkinToneId = (typeof SKIN_TONES)[number]["id"];
export type HairStyle = (typeof HAIR_STYLES)[number];
export type HairColorId = (typeof HAIR_COLORS)[number]["id"];
export type OutfitColorId = (typeof OUTFIT_COLORS)[number]["id"];
export type Accessory = (typeof ACCESSORIES)[number];

const ids = <T extends readonly { id: string }[]>(list: T) =>
  list.map((x) => x.id) as [string, ...string[]];

export const avatarSchema = z.object({
  name: z.string().trim().max(24).default(""),
  skin: z.enum(ids(SKIN_TONES)).default("sand"),
  hair: z.enum(HAIR_STYLES).default("short"),
  hairColor: z.enum(ids(HAIR_COLORS)).default("black"),
  outfit: z.enum(ids(OUTFIT_COLORS)).default("plum"),
  accessory: z.enum(ACCESSORIES).default("none")
});

export type Avatar = z.infer<typeof avatarSchema>;

/** Both characters. "A" is whoever is making the comic. */
export const avatarPairSchema = z.object({
  a: avatarSchema,
  b: avatarSchema
});

export type AvatarPair = z.infer<typeof avatarPairSchema>;

export const DEFAULT_PAIR: AvatarPair = {
  a: { name: "", skin: "sand", hair: "short", hairColor: "black", outfit: "plum", accessory: "none" },
  b: { name: "", skin: "honey", hair: "long", hairColor: "darkbrown", outfit: "ocean", accessory: "none" }
};

// ---- lookups ---------------------------------------------------------------

function byId<T extends readonly { id: string }[]>(list: T, id: string, fallback: T[number]) {
  return (list.find((x) => x.id === id) ?? fallback) as T[number];
}

export const skinOf = (a: Avatar) => byId(SKIN_TONES, a.skin, SKIN_TONES[1]);
export const hairColorOf = (a: Avatar) => byId(HAIR_COLORS, a.hairColor, HAIR_COLORS[0]);
export const outfitOf = (a: Avatar) => byId(OUTFIT_COLORS, a.outfit, OUTFIT_COLORS[0]);

export const HAIR_LABELS: Record<HairStyle, string> = {
  short: "Short",
  long: "Long",
  bun: "Bun",
  curly: "Curly",
  ponytail: "Ponytail",
  buzz: "Buzzed",
  bob: "Bob",
  wavy: "Wavy"
};

export const ACCESSORY_LABELS: Record<Accessory, string> = {
  none: "None",
  glasses: "Glasses",
  sunglasses: "Sunglasses",
  earrings: "Earrings",
  cap: "Cap",
  scarf: "Scarf",
  headphones: "Headphones"
};
