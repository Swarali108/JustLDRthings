import {
  DOODLE_W,
  DOODLE_H,
  strokePath,
  inkColor,
  nibWidth,
  paperColor,
  type Doodle
} from "@/lib/doodle";

/**
 * Renders a doodle as SVG.
 *
 * Shared by the creator preview and the recipient page, so what you drew is
 * literally the same element they open. Being vector rather than a bitmap also
 * means it stays sharp at any size, including printed from the keepsake.
 */
export function DoodleView({ doodle }: { doodle: Doodle }) {
  return (
    <svg
      className="doodle-svg"
      viewBox={`0 0 ${DOODLE_W} ${DOODLE_H}`}
      role="img"
      aria-label="A hand-drawn doodle"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x="0" y="0" width={DOODLE_W} height={DOODLE_H} fill={paperColor(doodle.paper)} />
      {doodle.strokes.map((stroke, i) => (
        <path
          key={i}
          d={strokePath(stroke)}
          stroke={inkColor(stroke.c)}
          strokeWidth={nibWidth(stroke.w)}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
