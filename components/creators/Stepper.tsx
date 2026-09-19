"use client";

/**
 * A + / − counter for one bouquet ingredient.
 *
 * Two caps apply at once and they fail differently, so both are surfaced: `−` is
 * disabled at zero, `+` is disabled either when this ingredient has hit its own
 * limit or when the bouquet is full. Without the distinction, a disabled `+`
 * looks like a bug when the real reason is that the bouquet holds no more.
 */
export function Stepper({
  label,
  meaning,
  count,
  perKindMax,
  atTotal,
  onAdd,
  onRemove,
  children
}: {
  label: string;
  meaning?: string;
  count: number;
  perKindMax: number;
  atTotal: boolean;
  onAdd: () => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const full = count >= perKindMax;
  const cannotAdd = full || atTotal;

  return (
    <div className={`stepper${count > 0 ? " stepper-on" : ""}`}>
      <span className="stepper-art" aria-hidden>
        {children}
      </span>

      <strong className="stepper-label">{label}</strong>
      {meaning ? <small className="stepper-meaning">{meaning}</small> : null}

      <span className="stepper-controls">
        <button
          type="button"
          onClick={onRemove}
          disabled={count === 0}
          aria-label={`Remove one ${label}`}
        >
          −
        </button>
        <output aria-label={`${label} count`}>{count}</output>
        <button
          type="button"
          onClick={onAdd}
          disabled={cannotAdd}
          aria-label={
            atTotal && !full
              ? `Bouquet is full — cannot add more ${label}`
              : `Add one ${label}`
          }
        >
          +
        </button>
      </span>
    </div>
  );
}
