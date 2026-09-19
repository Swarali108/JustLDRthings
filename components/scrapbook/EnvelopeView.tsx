"use client";

import { useState } from "react";
import { ENVELOPE_SKINS, type EnvelopeId } from "@/lib/envelope";

/**
 * A sealed letter the recipient opens.
 *
 * Client component because opening is an interaction, but the letter itself is
 * passed in as `children` — rendered on the server and handed across the
 * boundary as already-rendered output. That keeps the letter's markup out of the
 * client bundle and means this component never needs to know what a letter is.
 *
 * The closed envelope is a `<button>`, not a div: opening it is an action, so it
 * must be reachable by keyboard and announce itself to a screen reader.
 */
export function EnvelopeView({
  envelope = "cream",
  seal = "♡",
  label,
  children
}: {
  envelope?: EnvelopeId;
  seal?: string;
  label?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const skin = ENVELOPE_SKINS[envelope] ?? ENVELOPE_SKINS.cream;

  if (open) {
    return <div className="letter-opened">{children}</div>;
  }

  return (
    <div className="envelope-wrap">
      <button
        type="button"
        className="envelope"
        onClick={() => setOpen(true)}
        aria-label={label ? `Open the letter: ${label}` : "Open the letter"}
      >
        <svg viewBox="0 0 320 210" className="envelope-svg" role="presentation">
          <rect x="4" y="30" width="312" height="176" rx="10" fill={skin.body} />
          {/* Back flaps, giving the envelope its folded look. */}
          <path d="M 4 40 L 160 140 L 316 40 L 316 30 L 4 30 Z" fill={skin.liner} opacity="0.55" />
          <path d="M 4 206 L 130 120 L 4 40 Z" fill={skin.flap} opacity="0.45" />
          <path d="M 316 206 L 190 120 L 316 40 Z" fill={skin.flap} opacity="0.45" />
          {/* The front flap, still closed. */}
          <path d="M 4 34 L 160 134 L 316 34 L 316 30 A 10 10 0 0 0 306 20 L 14 20 A 10 10 0 0 0 4 30 Z" fill={skin.flap} />
          <circle cx="160" cy="118" r="21" fill={skin.seal} />
          <text
            x="160"
            y="126"
            textAnchor="middle"
            fontSize="21"
            fill={skin.body}
            aria-hidden
          >
            {seal}
          </text>
        </svg>

        <span className="envelope-hint" style={{ color: skin.ink }}>
          {label ? <strong>{label}</strong> : null}
          <span>Tap to open ♡</span>
        </span>
      </button>
    </div>
  );
}
