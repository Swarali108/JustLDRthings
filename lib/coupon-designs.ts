import { z } from "zod";

/**
 * Coupon designs.
 *
 * Each is a small bundle of literal colours plus a shape flag the renderer acts
 * on. Literal rather than CSS variables, again, so the offline keepsake shows
 * the same coupon; a flag rather than a class name so both the app and the
 * hand-built keepsake HTML can branch on it without sharing a stylesheet.
 */

export const COUPON_DESIGNS = [
  "ticket",
  "vintage",
  "modern",
  "heart",
  "kraft",
  "boarding",
  "stamp",
  "neon"
] as const;

export type CouponDesign = (typeof COUPON_DESIGNS)[number];

export interface CouponSkin {
  label: string;
  bg: string;
  ink: string;
  accent: string;
  border: string;
  /** Dashed edge, notched stub, perforation, or none. */
  edge: "dashed" | "notched" | "perforated" | "solid";
  /** Small word above the promise. */
  tag: string;
  /** Corner flourish, or empty for none. */
  flourish: string;
}

export const COUPON_SKINS: Record<CouponDesign, CouponSkin> = {
  ticket: {
    label: "Classic ticket",
    bg: "#f7f3ef",
    ink: "#211622",
    accent: "#6a2147",
    border: "#8c657c",
    edge: "dashed",
    tag: "Love Coupon",
    flourish: ""
  },
  vintage: {
    label: "Vintage",
    bg: "#efe4cd",
    ink: "#4a3a22",
    accent: "#8a6a2f",
    border: "#b39759",
    edge: "notched",
    tag: "Admit One",
    flourish: "❧"
  },
  modern: {
    label: "Modern",
    bg: "#1f2430",
    ink: "#eef1f7",
    accent: "#7fb3e8",
    border: "#3c4657",
    edge: "solid",
    tag: "Redeemable",
    flourish: ""
  },
  heart: {
    label: "Hearts",
    bg: "#fbe4ea",
    ink: "#5c1f35",
    accent: "#c2415f",
    border: "#e0a2b4",
    edge: "dashed",
    tag: "One Promise",
    flourish: "♡"
  },
  kraft: {
    label: "Kraft",
    bg: "#dfc3a0",
    ink: "#4a3520",
    accent: "#7a5433",
    border: "#a58055",
    edge: "perforated",
    tag: "Voucher",
    flourish: "✂"
  },
  boarding: {
    label: "Boarding pass",
    bg: "#eaf1f7",
    ink: "#17324a",
    accent: "#2f6d9e",
    border: "#9dbcd4",
    edge: "notched",
    tag: "Boarding Pass",
    flourish: "✈"
  },
  stamp: {
    label: "Postage stamp",
    bg: "#f6efe2",
    ink: "#3a2d1e",
    accent: "#9a5b3f",
    border: "#c9a87e",
    edge: "perforated",
    tag: "Par Avion",
    flourish: "✉"
  },
  neon: {
    label: "Neon night",
    bg: "#241634",
    ink: "#f6ecff",
    accent: "#ef7fd0",
    border: "#6d4090",
    edge: "solid",
    tag: "Good Any Time",
    flourish: "✦"
  }
};

export const couponDesignSchema = z.enum(COUPON_DESIGNS).default("ticket");
