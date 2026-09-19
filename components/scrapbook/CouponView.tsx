import { COUPON_SKINS, type CouponDesign } from "@/lib/coupon-designs";

/**
 * A love coupon in one of its designs.
 *
 * Presentational, and takes the redeem control as `children` so the same markup
 * serves the owner preview (no redeem button), the recipient page (a working
 * one) and the guest link (a keepsake with none) without knowing which it is in.
 */
export function CouponView({
  design = "ticket",
  text,
  expiresAt,
  children
}: {
  design?: CouponDesign;
  text: string;
  expiresAt?: string | null;
  children?: React.ReactNode;
}) {
  const skin = COUPON_SKINS[design] ?? COUPON_SKINS.ticket;

  return (
    <div
      className={`coupon-card coupon-edge-${skin.edge}`}
      style={{
        background: skin.bg,
        color: skin.ink,
        borderColor: skin.border
      }}
    >
      {skin.edge === "notched" ? (
        <>
          <span className="coupon-notch coupon-notch-l" style={{ background: skin.border }} />
          <span className="coupon-notch coupon-notch-r" style={{ background: skin.border }} />
        </>
      ) : null}

      <span className="coupon-eyebrow" style={{ color: skin.accent, borderColor: skin.border }}>
        {skin.tag}
      </span>

      {skin.flourish ? (
        <span className="coupon-flourish" style={{ color: skin.accent }} aria-hidden>
          {skin.flourish}
        </span>
      ) : null}

      <strong className="coupon-promise">{text}</strong>

      <span className="coupon-rule" style={{ borderColor: skin.border }} />

      <small className="coupon-expiry" style={{ color: skin.accent }}>
        {expiresAt
          ? `Good until ${new Date(expiresAt).toLocaleDateString()}`
          : "Redeem any time ♡"}
      </small>

      {children}
    </div>
  );
}
