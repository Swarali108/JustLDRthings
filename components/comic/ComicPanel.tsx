import {
  bubbleFontSize,
  bubbleLines,
  layoutFor,
  type Panel,
  type Speaker
} from "@/lib/comic";
import type { AvatarPair } from "@/lib/avatar";
import { CharacterArt } from "@/components/comic/CharacterArt";
import { BackgroundArt } from "@/components/comic/BackgroundArt";

/**
 * One comic panel: background, up to two characters, speech bubbles, caption.
 *
 * Drawn entirely in SVG including the text, so the whole panel scales as one
 * thing and a bubble can never drift away from the mouth it belongs to — which
 * is what happens when bubbles are HTML positioned over an SVG.
 *
 * SVG has no text wrapping, so the wrapping is done here in code. That turns
 * out to be the feature rather than a workaround: knowing the line count before
 * drawing is what lets the bubble be sized to its text instead of hoping.
 */

const W = 300;
const H = 200;

/** Break text into lines that fit, longest-word-safe. */
function wrap(text: string, charsPerLine: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    if (line && `${line} ${word}`.length > charsPerLine) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function Bubble({
  text,
  speaker,
  index,
  total
}: {
  text: string;
  speaker: Speaker;
  index: number;
  total: number;
}) {
  const narrator = speaker === "narrator";
  const size = bubbleFontSize(text, W);
  const charsPerLine = Math.max(14, Math.floor((W * 0.42) / (size * 0.52)));
  const lines = wrap(text, charsPerLine);
  const lineHeight = size * 1.25;

  const boxW = Math.min(W * 0.52, Math.max(70, charsPerLine * size * 0.54));
  const boxH = lines.length * lineHeight + 12;

  // Stacked from the top, so two bubbles never sit on each other.
  const y = 8 + index * (boxH + 6);
  const x = narrator ? W / 2 - boxW / 2 : speaker === "A" ? 8 : W - boxW - 8;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={boxW}
        height={boxH}
        rx={narrator ? 4 : 10}
        fill={narrator ? "rgba(43,32,41,0.86)" : "#fdfcfa"}
        stroke={narrator ? "none" : "#2b2029"}
        strokeWidth="1.4"
      />
      {!narrator ? (
        <path
          d={
            speaker === "A"
              ? `M ${x + 16} ${y + boxH} l 0 9 l 11 -9 Z`
              : `M ${x + boxW - 16} ${y + boxH} l 0 9 l -11 -9 Z`
          }
          fill="#fdfcfa"
          stroke="#2b2029"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      ) : null}

      <text
        x={x + boxW / 2}
        y={y + lineHeight * 0.95}
        textAnchor="middle"
        fontSize={size}
        fontFamily="Inter, system-ui, sans-serif"
        fill={narrator ? "#f6f1ea" : "#2b2029"}
        fontStyle={narrator ? "italic" : "normal"}
      >
        {lines.map((line, i) => (
          <tspan key={i} x={x + boxW / 2} dy={i === 0 ? 0 : lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
      {/* total is unused visually but keeps the signature honest about stacking */}
      <desc>{`${speaker} line ${index + 1} of ${total}`}</desc>
    </g>
  );
}

export function ComicPanel({
  panel,
  avatars,
  index
}: {
  panel: Panel;
  avatars: AvatarPair;
  index: number;
}) {
  const placed = layoutFor(panel.characters, panel.background);

  // Bubbles sit at the top; characters are pushed down so the two never collide.
  const bubbleDepth = panel.dialogue.reduce(
    (acc, d) => acc + bubbleLines(d.text) * bubbleFontSize(d.text, W) * 1.25 + 18,
    8
  );
  const feet = Math.max(150, Math.min(180, bubbleDepth + 108));

  return (
    <svg
      className="comic-panel"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Panel ${index + 1}${panel.caption ? `: ${panel.caption}` : ""}`}
    >
      <BackgroundArt background={panel.background} />

      {placed.map(({ character, x }, i) => (
        <g key={`${character.who}-${i}`} transform={`translate(${(x / 100) * W} ${feet}) scale(0.92)`}>
          <CharacterArt
            avatar={character.who === "A" ? avatars.a : avatars.b}
            pose={character.pose}
            expression={character.expression}
            // The right-hand character faces inward, toward the other one.
            flip={x > 50}
          />
        </g>
      ))}

      {panel.dialogue.map((line, i) => (
        <Bubble
          key={i}
          text={line.text}
          speaker={line.speaker}
          index={i}
          total={panel.dialogue.length}
        />
      ))}

      {panel.caption ? (
        <g>
          <rect x="0" y={H - 22} width={W} height="22" fill="rgba(252,250,248,0.92)" />
          <text
            x={W / 2}
            y={H - 7}
            textAnchor="middle"
            fontSize="11"
            fontFamily="Inter, system-ui, sans-serif"
            fill="#2b2029"
          >
            {panel.caption}
          </text>
        </g>
      ) : null}

      <rect x="1" y="1" width={W - 2} height={H - 2} fill="none" stroke="#2b2029" strokeWidth="2.5" />
    </svg>
  );
}
