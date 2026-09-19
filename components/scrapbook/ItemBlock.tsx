import type { ContentType, MediaType, SharedCoupon } from "@/types/db";
import { CouponRedeem } from "@/components/scrapbook/CouponRedeem";
import { BouquetView } from "@/components/scrapbook/BouquetView";
import { DoodleView } from "@/components/scrapbook/DoodleView";
import { doodleSchema } from "@/lib/doodle";
import { arrangementMeanings } from "@/lib/flowers";
import { readStyle, styleClasses, tiltStyle } from "@/lib/style";
import { readPaper, paperStyle } from "@/lib/paper";
import { ENVELOPES, type EnvelopeId } from "@/lib/envelope";
import { COUPON_DESIGNS, type CouponDesign } from "@/lib/coupon-designs";
import { EnvelopeView } from "@/components/scrapbook/EnvelopeView";
import { CouponView } from "@/components/scrapbook/CouponView";

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

/** Narrow an untrusted string to a known id, or fall back. */
function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** Decorations sit in their own absolutely-positioned layer, above the card. */
function Stickers({ stickers }: { stickers: string[] }) {
  if (stickers.length === 0) return null;
  return (
    <span className="sticker-layer" aria-hidden>
      {stickers.map((sticker, i) => (
        <span key={sticker} className={`sticker sticker-${i}`}>
          {sticker}
        </span>
      ))}
    </span>
  );
}

/**
 * Renders a single scrapbook block. Pure/presentational so it can be used in the
 * owner preview, the recipient page and the guest page alike. `token` enables
 * coupon redemption.
 *
 * Every block is wrapped in the item's chosen style — colour, lettering,
 * placement, tilt — read from `payload.style` with defaults filled in, so an
 * item saved before styling existed still renders.
 */
export function ItemBlock({ item, token }: { item: RenderItem; token?: string }) {
  const p = item.payload as Record<string, string>;
  const style = readStyle(item.payload);

  return (
    <div className={styleClasses(style)}>
      <div style={tiltStyle(style)}>
        <Body item={item} payload={p} token={token} stickers={style.stickers} />
      </div>
    </div>
  );
}

function Body({
  item,
  payload: p,
  token,
  stickers
}: {
  item: RenderItem;
  payload: Record<string, string>;
  token?: string;
  stickers: string[];
}) {
  switch (item.type) {
    case "note":
    case "letter": {
      const paper = readPaper(item.payload);
      const sheet = (
        <div className="paper-sheet" style={paperStyle(paper.color, paper.pattern)}>
          <div className={`paper-inner pattern-${paper.pattern}`}>
            {item.title ? <h3 className="block-title">{item.title}</h3> : null}
            <p className="block-body">{p.body}</p>
          </div>
        </div>
      );

      // A sealed letter arrives closed; the recipient clicks to open it. The
      // sheet is passed as children, so it stays server-rendered.
      const sealed = item.type === "letter" && Boolean(item.payload.sealed);

      return (
        <article className="block block-paper styled-block">
          <Stickers stickers={stickers} />
          {sealed ? (
            <EnvelopeView
              envelope={oneOf<EnvelopeId>(item.payload.envelope, ENVELOPES, "cream")}
              seal={typeof p.seal === "string" ? p.seal : "\u2661"}
              label={item.title}
            >
              {sheet}
            </EnvelopeView>
          ) : (
            sheet
          )}
        </article>
      );
    }

    case "song":
      return (
        <article className="block block-song styled-block">
          <Stickers stickers={stickers} />
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
        <article className="block block-coupon styled-block">
          <Stickers stickers={stickers} />
          <CouponView
            design={oneOf<CouponDesign>(item.payload.design, COUPON_DESIGNS, "ticket")}
            text={item.coupon?.coupon_text || item.title}
            expiresAt={item.coupon?.expires_at ?? null}
          >
            <CouponRedeem coupon={item.coupon} token={token} />
          </CouponView>
        </article>
      );

    case "bouquet": {
      const stems = Array.isArray(item.payload.stems) ? (item.payload.stems as string[]) : [];
      const greens = Array.isArray(item.payload.greenery)
        ? (item.payload.greenery as string[])
        : [];
      return (
        <article className="block styled-block">
          {item.title ? <h3 className="block-title">{item.title}</h3> : null}
          <BouquetView
            stems={stems}
            greenery={greens}
            wrap={p.wrap}
            ribbon={p.ribbon}
            note={p.note}
            meanings={arrangementMeanings(stems, greens)}
            stickers={stickers}
          />
        </article>
      );
    }

    case "doodle": {
      // Re-validated at render: this payload may have come from a URL, and a
      // malformed one should show nothing rather than throw mid-page.
      const drawing = doodleSchema.safeParse(item.payload.doodle);
      return (
        <article className="block styled-block">
          <Stickers stickers={stickers} />
          {item.title ? <h3 className="block-title">{item.title}</h3> : null}
          {drawing.success ? (
            <DoodleView doodle={drawing.data} />
          ) : (
            <span className="paper-placeholder">This drawing didn&apos;t come through</span>
          )}
          {p.note ? <p className="block-body">{p.note}</p> : null}
        </article>
      );
    }

    case "collage":
      return (
        <article className="block styled-block">
          <Stickers stickers={stickers} />
          {item.title ? <h3 className="block-title">{item.title}</h3> : null}
          {item.media.length ? (
            <div className={`collage-grid count-${item.media.length}`}>
              {item.media.map((m, i) => (
                <div key={m.url || i} className="collage-cell">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={`${item.title || "Collage"} photo ${i + 1}`} />
                </div>
              ))}
            </div>
          ) : (
            <span className="paper-placeholder">Photos unavailable</span>
          )}
          {p.caption ? <p className="media-caption">{p.caption}</p> : null}
        </article>
      );

    case "media": {
      const m = item.media[0];
      return (
        <article className="block block-media styled-block">
          <Stickers stickers={stickers} />
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
        <article className="block block-voice styled-block">
          <Stickers stickers={stickers} />
          <strong>{item.title || "A voice note"}</strong>
          {m ? <audio src={m.url} controls /> : <p>Audio unavailable</p>}
          {p.transcript ? <p className="voice-transcript">“{p.transcript}”</p> : null}
        </article>
      );
    }

    default:
      return (
        <article className="block block-paper paper-blue styled-block">
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
