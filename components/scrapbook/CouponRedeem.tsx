"use client";

import { useState } from "react";
import type { SharedCoupon } from "@/types/db";

function computeState(c: SharedCoupon | null): "redeemed" | "expired" | "ready" | "none" {
  if (!c) return "none";
  if (c.redeemed_at) return "redeemed";
  if (c.expires_at && new Date(c.expires_at) <= new Date()) return "expired";
  return "ready";
}

/**
 * Coupon status + (recipient-only) redeem button. Redemption goes through the
 * server, which calls the SECURITY DEFINER redeem_coupon RPC scoped to the token.
 */
export function CouponRedeem({
  coupon,
  token
}: {
  coupon: SharedCoupon | null;
  token?: string;
}) {
  const [state, setState] = useState(() => computeState(coupon));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const label =
    state === "redeemed"
      ? "Redeemed ♡"
      : state === "expired"
        ? "Expired"
        : "Ready to redeem";

  async function redeem() {
    if (!token || !coupon) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/coupons/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponId: coupon.id, token })
      });
      const data = await res.json();
      if (data?.ok) {
        setState("redeemed");
        setMsg(data.already ? "You'd already cashed this in ♡" : "Redeemed ♡ enjoy!");
      } else {
        setMsg(data?.reason === "expired" ? "This coupon has expired." : "Couldn't redeem this one.");
        if (data?.reason === "expired") setState("expired");
      }
    } catch {
      setMsg("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="coupon-foot">
      <small aria-live="polite">
        {/* icon + word: never rely on color alone */}
        {state === "redeemed" ? "✓ " : state === "expired" ? "✕ " : "○ "}
        {label}
      </small>
      {token && state === "ready" ? (
        <button type="button" className="button button-plum" onClick={redeem} disabled={busy}>
          {busy ? "…" : "Redeem"}
        </button>
      ) : null}
      {msg ? <small className="coupon-msg">{msg}</small> : null}
    </div>
  );
}
