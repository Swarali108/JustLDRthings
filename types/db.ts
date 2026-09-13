// Hand-written types for the JustLDRthings schema. These mirror
// supabase/migrations/0001_init.sql. If the schema grows, regenerate with the
// Supabase CLI (`supabase gen types typescript`) and replace this file.

export type ContentType =
  | "note"
  | "letter"
  | "song"
  | "coupon"
  | "media"
  | "voice"
  | "doodle"
  | "bouquet"
  | "collage";

export type PageStatus = "draft" | "published";
export type MediaType = "image" | "video" | "audio";

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Page {
  id: string;
  owner_id: string;
  title: string;
  status: PageStatus;
  theme: string;
  created_at: string;
  updated_at: string;
}

export interface ContentItem {
  id: string;
  owner_id: string;
  type: ContentType;
  title: string;
  payload_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PageItem {
  id: string;
  page_id: string;
  content_item_id: string;
  sort_order: number;
  layout_json: Record<string, unknown>;
}

export interface MediaAsset {
  id: string;
  owner_id: string;
  content_item_id: string;
  storage_path: string;
  media_type: MediaType;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface Coupon {
  id: string;
  content_item_id: string;
  coupon_text: string;
  expires_at: string | null;
  redeemed_at: string | null;
}

export interface PageShare {
  id: string;
  page_id: string;
  token_hash: string;
  enabled: boolean;
  expires_at: string | null;
  created_at: string;
}

// Shape returned by the resolve_shared_page RPC (recipient-safe).
export interface SharedMedia {
  storage_path: string;
  media_type: MediaType;
  mime_type: string | null;
  signed_url?: string | null;
}

export interface SharedCoupon {
  id: string;
  coupon_text: string;
  expires_at: string | null;
  redeemed_at: string | null;
}

export interface SharedItem {
  id: string;
  type: ContentType;
  title: string;
  payload: Record<string, unknown>;
  layout: Record<string, unknown>;
  media: SharedMedia[];
  coupon: SharedCoupon | null;
}

export interface SharedPage {
  page: { title: string; theme: string };
  items: SharedItem[];
}
