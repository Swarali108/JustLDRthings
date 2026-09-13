import { signUserMedia } from "@/lib/media";
import type { RenderItem } from "@/components/scrapbook/ItemBlock";
import type { ContentItem, Coupon, MediaAsset } from "@/types/db";

interface OwnerClient {
  from: (table: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  storage: Parameters<typeof signUserMedia>[0];
}

/**
 * Build recipient-safe RenderItems for the page owner (preview), using their
 * own RLS-scoped client to sign private media.
 */
export async function renderItemsForOwner(
  supabase: OwnerClient,
  orderedItems: ContentItem[]
): Promise<RenderItem[]> {
  const ids = orderedItems.map((i) => i.id);
  if (ids.length === 0) return [];

  const [{ data: mediaRows }, { data: couponRows }] = await Promise.all([
    supabase.from("media_assets").select("*").in("content_item_id", ids),
    supabase.from("coupons").select("*").in("content_item_id", ids)
  ]);
  const media = (mediaRows ?? []) as MediaAsset[];
  const coupons = (couponRows ?? []) as Coupon[];
  const signed = await signUserMedia(
    supabase.storage,
    media.map((m) => m.storage_path)
  );

  return orderedItems.map((ci) => {
    const itemMedia = media
      .filter((m) => m.content_item_id === ci.id)
      .map((m) => ({
        url: signed[m.storage_path] || "",
        media_type: m.media_type,
        mime: m.mime_type
      }));
    const coupon = coupons.find((c) => c.content_item_id === ci.id) ?? null;
    return {
      id: ci.id,
      type: ci.type,
      title: ci.title,
      payload: ci.payload_json,
      media: itemMedia,
      coupon: coupon
        ? {
            id: coupon.id,
            coupon_text: coupon.coupon_text,
            expires_at: coupon.expires_at,
            redeemed_at: coupon.redeemed_at
          }
        : null
    };
  });
}
