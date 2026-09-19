"use client";

import {
  PAPER_COLORS,
  PAPER_PATTERNS,
  PAPER_COLOR_LABELS,
  PAPER_PATTERN_LABELS,
  PAPER_SKINS,
  paperStyle,
  type PaperChoice,
  type PaperColor,
  type PaperPattern
} from "@/lib/paper";

/**
 * Colour and surface pattern for a note or a letter.
 *
 * Two rows rather than one combined list of every pairing: five colours times
 * five patterns is twenty-five looks, and a flat list of twenty-five chips would
 * be unreadable. Each swatch previews the real paper rather than naming it.
 */
export function PaperPicker({
  value,
  onChange
}: {
  value: PaperChoice;
  onChange: (next: PaperChoice) => void;
}) {
  return (
    <>
      <span className="style-legend">Paper colour</span>
      <div className="style-row">
        {PAPER_COLORS.map((color: PaperColor) => (
          <button
            key={color}
            type="button"
            className="style-chip wrap-chip"
            aria-pressed={value.color === color}
            onClick={() => onChange({ ...value, color })}
          >
            <span className="wrap-swatch" style={{ background: PAPER_SKINS[color].bg }} />
            {PAPER_COLOR_LABELS[color]}
          </button>
        ))}
      </div>

      <span className="style-legend">Paper pattern</span>
      <div className="style-row">
        {PAPER_PATTERNS.map((pattern: PaperPattern) => (
          <button
            key={pattern}
            type="button"
            className="style-chip wrap-chip"
            aria-pressed={value.pattern === pattern}
            onClick={() => onChange({ ...value, pattern })}
          >
            <span
              className={`wrap-swatch pattern-swatch pattern-${pattern}`}
              style={paperStyle(value.color, pattern)}
            />
            {PAPER_PATTERN_LABELS[pattern]}
          </button>
        ))}
      </div>
    </>
  );
}
