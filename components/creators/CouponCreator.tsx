"use client";

import { useActionState, useState } from "react";
import { saveCoupon, type CreateState } from "@/app/create/actions";
import { couponSchema } from "@/lib/validation";
import { GuestResult } from "@/components/guest/GuestResult";
import { guestItemToBlock, type KeepsakeBlock } from "@/components/guest/keepsake";
import type { GuestItem, GuestPayload } from "@/lib/guest-share";

const initial: CreateState = {};

interface GuestDone {
  title: string;
  payload: GuestPayload;
  blocks: KeepsakeBlock[];
}

export function CouponCreator({ signedIn }: { signedIn: boolean }) {
  const [state, formAction, pending] = useActionState(saveCoupon, initial);
  const [text, setText] = useState("");
  const [guest, setGuest] = useState<GuestDone | null>(null);
  const [guestError, setGuestError] = useState("");

  function onGuestSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = couponSchema.safeParse({
      title: form.get("title") ?? "",
      coupon_text: form.get("coupon_text") ?? "",
      expires_at: form.get("expires_at") ?? ""
    });

    if (!parsed.success) {
      setGuestError(parsed.error.issues[0].message);
      return;
    }

    const local = parsed.data.expires_at;
    const expiry = local ? new Date(local) : null;
    const title = parsed.data.title || "A love coupon";

    const item: GuestItem = {
      type: "coupon",
      title,
      payload: {},
      coupon: {
        coupon_text: parsed.data.coupon_text,
        expires_at: expiry && !isNaN(expiry.getTime()) ? expiry.toISOString() : null
      }
    };

    setGuestError("");
    setGuest({
      title,
      payload: { v: 1, title, items: [item] },
      blocks: [guestItemToBlock(item)]
    });
  }

  const formProps = signedIn ? { action: formAction } : { onSubmit: onGuestSubmit };
  const error = signedIn ? state.error : guestError;

  return (
    <>
      <form {...formProps} className="studio-panel">
        <div className="field">
          <label htmlFor="title">Title (optional)</label>
          <input id="title" name="title" placeholder="A love coupon" />
        </div>
        <div className="field">
          <label htmlFor="coupon_text">The promise</label>
          <input
            id="coupon_text"
            name="coupon_text"
            required
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Redeemable for one long phone call ♡"
          />
        </div>
        <div className="field">
          <label htmlFor="expires_at">Expires (optional)</label>
          <input id="expires_at" name="expires_at" type="datetime-local" />
        </div>

        {!signedIn ? (
          <p className="form-notice">
            A coupon shared without an account is a keepsake — lovely to receive,
            but there&apos;s no &ldquo;redeemed&rdquo; button to press, since
            there&apos;s nowhere to record it. Sign in if you want that.
          </p>
        ) : null}

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="row-actions" style={{ marginTop: 16 }}>
          <button type="submit" className="button button-plum" disabled={pending}>
            {signedIn ? (pending ? "Saving…" : "Save this") : "Finish this ♡"}
          </button>
        </div>
      </form>

      {guest ? (
        <GuestResult
          title={guest.title}
          payload={guest.payload}
          blocks={guest.blocks}
          onEdit={() => setGuest(null)}
        />
      ) : (
        <div className="studio-panel">
          <p className="eyebrow">Preview</p>
          <div className="coupon-preview">
            <span className="coupon-tag">Love Coupon</span>
            <strong>{text || "A promise they can cash in later."}</strong>
            <span className="coupon-dash" />
            <small>Redeem any time ♡</small>
          </div>
        </div>
      )}
    </>
  );
}
