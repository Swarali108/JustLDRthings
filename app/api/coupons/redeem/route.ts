import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hashToken } from "@/lib/share";

/**
 * Redeem a coupon on a shared page. Authorization is enforced entirely inside
 * the redeem_coupon RPC, which requires the coupon to sit on a currently-shared
 * published page matching this token.
 */
export async function POST(request: Request) {
  let body: { couponId?: string; token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const couponId = String(body.couponId || "");
  const token = String(body.token || "");
  if (!couponId || !token) {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_coupon", {
    p_coupon_id: couponId,
    p_token_hash: hashToken(token)
  });

  if (error) {
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }
  return NextResponse.json(data ?? { ok: false, reason: "not_found" });
}
