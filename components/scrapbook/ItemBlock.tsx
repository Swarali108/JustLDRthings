import type { ContentType, MediaType, SharedCoupon } from "@/types/db";
import { CouponRedeem } from "@/components/scrapbook/CouponRedeem";

export interface RenderMedia {
  url: string;
  media_type: MediaType;
  mime: string | null;
}

export interface RenderItem {
  id: string;
  type: ContentType;
  title: string;
  payload: Record<string, unknown>;
  media: RenderMedia[];
  coupon: SharedCoupon | null;
}

function paperClass(payload: Record<string, unknown>): string {
  const p = typeof payload.paper === "string" ? payload.paper : "cream";
  return `paper-${p}`;
}

/**
 * Renders a single scrapbook block. Pure/presentational so it can be used in the
 * owner preview and the recipient page. `token` enables coupon redemption.
 */
export function ItemBlock({ item, token }: { item: RenderItem; token?: string }) {
  const p = item.payload as Record<string, string>;

  switch (item.type) {
    case "note":
    case "letter":
      return (
        <article className={`block block-paper ${paperClass(item.payload)}`}>
          {item.title ? <h3 className="block-title">{item.title}</h3> : null}
          <p className="block-body">{p.body}</p>
        </article>
      );

    case "song":
      return (
        <article className="block block-song">
          <div className="song-art">♫</div>
          <div className="song-meta">
            <strong>{item.title || "A song for you"}</strong>
            {p.note ? <p>{p.note}</p> : null}
            <a href={p.url} target="_blank" rel="noreferrer noopener" className="button button-light">
              Listen ♫
            </a>
          </div>
        </article>
      );

    case "coupon":
      return (
        <article className="block block-coupon">
          <span className="coupon-tag">Love Coupon</span>
          <strong>{item.coupon?.coupon_text || item.title}</strong>
          <span className="coupon-dash" />
          <CouponRedeem coupon={item.coupon} token={token} />
        </article>
      );

    case "media": {
      const m = item.media[0];
      return (
        <article className="block block-media">
          <div className="media-frame">
            {m ? (
              m.media_type === "video" ? (
                <video src={m.url} controls />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt={item.title || "A shared photo"} />
              )
            ) : (
              <span className="paper-placeholder">Media unavailable</span>
            )}
          </div>
          {p.caption ? <p className="media-caption">{p.caption}</p> : null}
        </article>
      );
    }

    case "voice": {
      const m = item.media[0];
      return (
        <article className="block block-voice">
          <strong>{item.title || "A voice note"}</strong>
          {m ? <audio src={m.url} controls /> : <p>Audio unavailable</p>}
          {p.transcript ? <p className="voice-transcript">“{p.transcript}”</p> : null}
        </article>
      );
    }

    default:
      return (
        <article className="block block-paper paper-blue">
          <h3 className="block-title">{item.title}</h3>
        </article>
      );
  }
}

export function displayCouponState(c: SharedCoupon | null): string {
  if (!c) return "";
  if (c.redeemed_at) return "Redeemed ♡";
  if (c.expires_at && new Date(c.expires_at) <= new Date()) return "Expired";
  return "Ready to redeem";
}
