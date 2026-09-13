"use client";

import { useActionState, useState } from "react";
import { saveCoupon, type CreateState } from "@/app/create/actions";

const initial: CreateState = {};

export function CouponCreator() {
  const [state, formAction, pending] = useActionState(saveCoupon, initial);
  const [text, setText] = useState("");

  return (
    <>
      <form action={formAction} className="studio-panel">
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

        {state.error ? (
          <p className="form-error" role="alert">
            {state.error}
          </p>
        ) : null}

        <div className="row-actions" style={{ marginTop: 16 }}>
          <button type="submit" className="button button-plum" disabled={pending}>
            {pending ? "Saving…" : "Save this"}
          </button>
        </div>
      </form>

      <div className="studio-panel">
        <p className="eyebrow">Preview</p>
        <div className="coupon-preview">
          <span className="coupon-tag">Love Coupon</span>
          <strong>{text || "A promise they can cash in later."}</strong>
          <span className="coupon-dash" />
          <small>Redeem any time ♡</small>
        </div>
      </div>
    </>
  );
}
