"use client";

import { useRef, useState } from "react";
import {
  DOODLE_W,
  DOODLE_H,
  INKS,
  NIBS,
  PAPERS,
  MAX_STROKES,
  MAX_POINTS_PER_STROKE,
  simplify,
  strokePath,
  inkColor,
  nibWidth,
  paperColor,
  type Doodle,
  type DoodleStroke
} from "@/lib/doodle";

/**
 * The drawing surface.
 *
 * Draws into an SVG rather than a <canvas>: the strokes are the data model, so
 * rendering them directly keeps one representation instead of a bitmap plus a
 * parallel list. Pointer Events cover mouse, pen and touch in one handler, and
 * `touch-action: none` (in style.css) stops a drag from scrolling the page.
 */
export function DoodleCanvas({
  value,
  onChange
}: {
  value: Doodle;
  onChange: (next: Doodle) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drawing = useRef(false);
  const rawPoints = useRef<number[]>([]);

  const [ink, setInk] = useState(0);
  const [nib, setNib] = useState(1);
  const [live, setLive] = useState<number[]>([]);

  /** Screen coords → the fixed 1000x700 box, as integers. */
  function toBox(event: React.PointerEvent): [number, number] {
    const svg = svgRef.current;
    if (!svg) return [0, 0];
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * DOODLE_W;
    const y = ((event.clientY - rect.top) / rect.height) * DOODLE_H;
    return [Math.round(x), Math.round(y)];
  }

  function start(event: React.PointerEvent) {
    if (value.strokes.length >= MAX_STROKES) return;
    event.preventDefault();
    // Capture so a stroke keeps following the pointer outside the box.
    (event.target as Element).setPointerCapture?.(event.pointerId);
    drawing.current = true;
    const [x, y] = toBox(event);
    rawPoints.current = [x, y];
    setLive([x, y]);
  }

  function move(event: React.PointerEvent) {
    if (!drawing.current) return;
    event.preventDefault();
    if (rawPoints.current.length >= MAX_POINTS_PER_STROKE * 2) return;
    const [x, y] = toBox(event);
    rawPoints.current.push(x, y);
    setLive([...rawPoints.current]);
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;

    const points = simplify(rawPoints.current);
    rawPoints.current = [];
    setLive([]);
    if (points.length < 2) return;

    const stroke: DoodleStroke = { c: ink, w: nib, p: points };
    onChange({ ...value, strokes: [...value.strokes, stroke] });
  }

  function undo() {
    onChange({ ...value, strokes: value.strokes.slice(0, -1) });
  }

  function clear() {
    onChange({ ...value, strokes: [] });
  }

  const full = value.strokes.length >= MAX_STROKES;

  return (
    <div className="doodle-tools">
      <div className="style-row" role="group" aria-label="Ink colour">
        {INKS.map((color, i) => (
          <button
            key={color}
            type="button"
            className="ink-chip"
            aria-label={`Ink ${i + 1}`}
            aria-pressed={ink === i}
            style={{ background: color }}
            onClick={() => setInk(i)}
          />
        ))}
      </div>

      <div className="style-row" role="group" aria-label="Nib size">
        {NIBS.map((width, i) => (
          <button
            key={width}
            type="button"
            className="style-chip nib-chip"
            aria-label={`Nib ${width}`}
            aria-pressed={nib === i}
            onClick={() => setNib(i)}
          >
            <span
              className="nib-dot"
              style={{ width: width + 4, height: width + 4, background: inkColor(ink) }}
            />
          </button>
        ))}

        <button type="button" className="style-chip" onClick={undo} disabled={!value.strokes.length}>
          Undo
        </button>
        <button type="button" className="style-chip" onClick={clear} disabled={!value.strokes.length}>
          Clear
        </button>
      </div>

      <div className="style-row" role="group" aria-label="Paper">
        {PAPERS.map((paper, i) => (
          <button
            key={paper.label}
            type="button"
            className="style-chip"
            aria-pressed={value.paper === i}
            onClick={() => onChange({ ...value, paper: i })}
          >
            {paper.label}
          </button>
        ))}
      </div>

      <svg
        ref={svgRef}
        className="doodle-surface"
        viewBox={`0 0 ${DOODLE_W} ${DOODLE_H}`}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
      >
        <rect x="0" y="0" width={DOODLE_W} height={DOODLE_H} fill={paperColor(value.paper)} />

        {value.strokes.map((stroke, i) => (
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

        {/* The stroke under the finger right now, not yet committed. */}
        {live.length >= 2 ? (
          <path
            d={strokePath({ c: ink, w: nib, p: live })}
            stroke={inkColor(ink)}
            strokeWidth={nibWidth(nib)}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </svg>

      {full ? (
        <p className="form-notice">
          That&apos;s as many strokes as one doodle holds. Undo a few, or finish
          this one and start another. ♡
        </p>
      ) : null}
    </div>
  );
}
