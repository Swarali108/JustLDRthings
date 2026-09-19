import { z } from "zod";

/**
 * Envelopes for letters.
 *
 * A letter now arrives sealed: the recipient sees a closed envelope and clicks
 * it to open. The reason is pacing — a letter that is simply *there* is read in
 * the same breath as a text message, whereas one that has to be opened asks for
 * a second of attention first. The letter itself is unchanged underneath.
 *
 * Colours are literal so the downloaded keepsake, which has no stylesheet and no
 * network, renders the same envelope offline.
 */

export const ENVELOPES = ["cream", "blush", "kraft", "plum", "sage", "ink"] as const;
export type EnvelopeId = (typeof ENVELOPES)[number];

export interface EnvelopeSkin {
  label: string;
  /** Body of the envelope. */
  body: string;
  /** The front flap, a shade darker. */
  flap: string;
  /** The inner liner seen as it opens. */
  liner: string;
  /** Wax seal colour. */
  seal: string;
  ink: string;
}

export const ENVELOPE_SKINS: Record<EnvelopeId, EnvelopeSkin> = {
  cream: { label: "Cream", body: "#f4ece0", flap: "#e6dac8", liner: "#d9c9b0", seal: "#8c2f4a", ink: "#5a4633" },
  blush: { label: "Blush", body: "#f6dee2", flap: "#eec6cd", liner: "#e3adb8", seal: "#8c2f4a", ink: "#7d3a4c" },
  kraft: { label: "Kraft", body: "#ddbf9b", flap: "#c9a67c", liner: "#b08c63", seal: "#5a3a26", ink: "#54402a" },
  plum: { label: "Plum", body: "#5c2340", flap: "#471a31", liner: "#7d3157", seal: "#d4af62", ink: "#f4e9d8" },
  sage: { label: "Sage", body: "#dde5d8", flap: "#c6d3bf", liner: "#aebfa6", seal: "#4f6b46", ink: "#46523f" },
  ink: { label: "Midnight", body: "#2f3345", flap: "#242737", liner: "#434964", seal: "#d4af62", ink: "#eceaf4" }
};

export const envelopeSchema = z.enum(ENVELOPES).default("cream");

/** Wax-seal glyphs, kept to a closed set like everything else that renders. */
export const SEALS = ["♡", "✿", "★", "✉", "❧"] as const;
export type Seal = (typeof SEALS)[number];
export const sealSchema = z.enum(SEALS).default("♡");
