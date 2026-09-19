import { FLOWER_BY_ID, GREENERY_BY_ID, WRAP_BY_ID, RIBBON_BY_ID } from "@/lib/flowers";
import { FlowerGlyph, LeafGlyph } from "@/components/scrapbook/FlowerArt";
import { BQ, fanOut, balanced, wrapPetal, WRAP_LAYERS, STEM_TAILS } from "@/lib/bouquet-layout";

/**
 * The finished bouquet, drawn as one SVG.
 *
 * One drawing rather than a row of separate elements because everything has to
 * share a coordinate space: stems converge on a single tie point, the wrap folds
 * around that same point, and the heads fan into a dome above it. Positions come
 * from `lib/bouquet-layout` so the offline keepsake can place things identically.
 *
 * Draw order is the composition: wrap behind → greenery → stems → blooms → wrap
 * folded in front → ribbon. That is the order you would physically assemble it.
 */
export function BouquetView({
  stems,
  greenery = [],
  wrap = "peach",
  ribbon = "peach",
  note,
  meanings,
  stickers = []
}: {
  stems: string[];
  greenery?: string[];
  wrap?: string;
  ribbon?: string;
  note?: string;
  meanings: string[];
  stickers?: string[];
}) {
  if (stems.length === 0 && greenery.length === 0) return null;

  const paper = WRAP_BY_ID[wrap] ?? WRAP_BY_ID.peach;
  const tie = RIBBON_BY_ID[ribbon] ?? RIBBON_BY_ID.none;

  const greens = fanOut(balanced(greenery), BQ.greenSpread, BQ.greenReach);
  const blooms = fanOut(balanced(stems), BQ.flowerSpread, BQ.flowerReach, 74);

  return (
    <>
      {stickers.length ? (
        <span className="sticker-layer" aria-hidden>
          {stickers.map((sticker, i) => (
            <span key={sticker} className={`sticker sticker-${i}`}>
              {sticker}
            </span>
          ))}
        </span>
      ) : null}

      <div className="bouquet-stage">
        <svg
          className="bouquet-svg"
          viewBox={`0 0 ${BQ.width} ${BQ.height}`}
          role="img"
          aria-label={`A bouquet of ${stems.length} stems and ${greenery.length} leaves`}
        >
          {/* Stem ends below the tie. */}
          <g stroke="#6f8a63" strokeWidth="3" strokeLinecap="round">
            {STEM_TAILS.map((dx) => (
              <line
                key={dx}
                x1={BQ.tieX + dx * 0.4}
                y1={BQ.tieY}
                x2={BQ.tieX + dx}
                y2={BQ.tieY + 118}
              />
            ))}
          </g>

          {/* Paper behind the flowers. */}
          <g>
            {WRAP_LAYERS.back.map((layer, i) => (
              <path
                key={`wb-${i}`}
                d={wrapPetal(layer.length, layer.halfWidth)}
                fill={paper.front}
                opacity={layer.opacity}
                transform={`translate(${BQ.tieX} ${BQ.tieY}) rotate(${layer.angle})`}
              />
            ))}
          </g>

          {/* Greenery: each sprig rotated out from the tie. */}
          {greens.map((g, i) => {
            const leaf = GREENERY_BY_ID[g.id];
            if (!leaf) return null;
            return (
              <g
                key={`g-${g.id}-${i}`}
                transform={`translate(${BQ.tieX} ${BQ.tieY}) rotate(${g.angle}) scale(${g.reach / 90})`}
                opacity={g.depth ? 1 : 0.9}
              >
                <LeafGlyph leaf={leaf} />
              </g>
            );
          })}

          {/* Flower stems, drawn from the tie to each head. */}
          <g stroke="#6f8a63" strokeWidth="3.2" fill="none" strokeLinecap="round">
            {blooms.map((b, i) => (
              <path
                key={`s-${i}`}
                d={`M ${BQ.tieX} ${BQ.tieY} Q ${BQ.tieX + (b.x - BQ.tieX) * 0.35} ${
                  BQ.tieY - b.reach * 0.55
                }, ${b.x} ${b.y}`}
              />
            ))}
          </g>

          {/* The blooms themselves, deeper ones first. */}
          {[0, 1].map((depth) =>
            blooms
              .map((b, i) => ({ b, i }))
              .filter(({ b }) => b.depth === depth)
              .map(({ b, i }) => {
                const flower = FLOWER_BY_ID[b.id];
                if (!flower) return null;
                return (
                  <g
                    key={`f-${b.id}-${i}`}
                    transform={`translate(${b.x} ${b.y}) scale(${b.size / 100}) rotate(${b.angle * 0.5})`}
                  >
                    <title>{`${flower.label} — ${flower.meaning}`}</title>
                    <FlowerGlyph flower={flower} idSuffix={`-${i}`} />
                  </g>
                );
              })
          )}

          {/* Paper folded over the front of the stems. */}
          <g>
            {WRAP_LAYERS.front.map((layer, i) => (
              <path
                key={`wf-${i}`}
                d={wrapPetal(layer.length, layer.halfWidth)}
                fill={i === WRAP_LAYERS.front.length - 1 ? paper.fold : paper.front}
                opacity={layer.opacity}
                transform={`translate(${BQ.tieX} ${BQ.tieY}) rotate(${layer.angle})`}
              />
            ))}
          </g>

          {/* The tie. */}
          {tie.id !== "none" ? (
            <g transform={`translate(${BQ.tieX} ${BQ.tieY - 10})`}>
              <path
                d="M -6 0 C -44 -26, -76 -18, -70 2 C -76 22, -44 28, -6 4 Z"
                fill={tie.color}
              />
              <path
                d="M 6 0 C 44 -26, 76 -18, 70 2 C 76 22, 44 28, 6 4 Z"
                fill={tie.color}
              />
              <path d="M -8 6 C -18 34, -26 48, -34 62 L -18 60 C -12 46, -7 28, -4 12 Z" fill={tie.shade} />
              <path d="M 8 6 C 18 34, 26 48, 34 62 L 18 60 C 12 46, 7 28, 4 12 Z" fill={tie.shade} />
              <rect x="-11" y="-11" width="22" height="26" rx="8" fill={tie.shade} />
            </g>
          ) : null}
        </svg>
      </div>

      {note ? <p className="block-body">{note}</p> : null}

      {meanings.length ? (
        <p className="bouquet-meanings">
          {stems.length ? `${stems.length} ${stems.length === 1 ? "stem" : "stems"}` : "greenery only"}
          {greenery.length
            ? ` · ${greenery.length} ${greenery.length === 1 ? "leaf" : "leaves"}`
            : ""}{" "}
          · {meanings.join(" · ")}
        </p>
      ) : null}
    </>
  );
}
