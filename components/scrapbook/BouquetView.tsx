import {
  FLOWER_BY_ID,
  GREENERY_BY_ID,
  WRAP_BY_ID,
  RIBBON_BY_ID
} from "@/lib/flowers";
import { FlowerArt, LeafArt } from "@/components/scrapbook/FlowerArt";

/**
 * The finished bouquet: greenery fanned behind, blooms in front, gathered into a
 * folded paper cone and tied with a bow.
 *
 * Presentational and shared by the creator preview, the recipient page and the
 * dashboard, so what you arrange is exactly what they open. Placement is derived
 * from each item's index — never random — so the same bouquet is identical on
 * every render and on every machine.
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

  /** Fan an item outward from the middle: centre items sit highest. */
  function fan(i: number, total: number, spread: number, lift: number) {
    const mid = (total - 1) / 2;
    const offset = total === 1 ? 0 : (i - mid) / mid;
    return {
      transform: `translateX(${offset * spread}px) translateY(${Math.abs(offset) * lift}px) rotate(${offset * 16}deg)`
    };
  }

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
        <div className="bouquet-arrangement">
          {/* Greenery sits behind the blooms and fans wider. */}
          {greenery.length ? (
            <div className="bq-greens" aria-hidden>
              {greenery.map((id, i) => {
                const sprig = GREENERY_BY_ID[id];
                if (!sprig) return null;
                return (
                  <span
                    key={`${id}-${i}`}
                    className="bq-green"
                    style={fan(i, greenery.length, 78, 16)}
                  >
                    <LeafArt leaf={sprig} size={64} />
                  </span>
                );
              })}
            </div>
          ) : null}

          {stems.length ? (
            <div className="bq-blooms">
              {stems.map((id, i) => {
                const flower = FLOWER_BY_ID[id];
                if (!flower) return null;
                // Size cycles by position so the cluster reads as depth.
                const size = 46 + ((i * 5) % 3) * 9;
                return (
                  <span
                    key={`${id}-${i}`}
                    className="bq-bloom"
                    title={`${flower.label} — ${flower.meaning}`}
                    style={fan(i, stems.length, 62, 22)}
                  >
                    <FlowerArt flower={flower} size={size} />
                  </span>
                );
              })}
            </div>
          ) : null}

          {/* The wrap: a folded cone with a turned-back collar, tied with a bow. */}
          <div className="bq-wrap" aria-hidden>
            <svg viewBox="0 0 200 210" className="bq-cone" role="presentation">
              <path d="M 100 4 L 190 66 L 132 206 L 68 206 L 10 66 Z" fill={paper.front} />
              <path d="M 100 4 L 190 66 L 100 96 Z" fill={paper.fold} opacity="0.95" />
              <path d="M 100 4 L 10 66 L 100 96 Z" fill={paper.fold} opacity="0.75" />
              <path d="M 100 96 L 132 206 L 68 206 Z" fill={paper.fold} opacity="0.25" />
            </svg>

            {tie.id !== "none" ? (
              <svg viewBox="0 0 120 50" className="bq-bow" role="presentation">
                <path d="M 58 25 C 34 4, 6 8, 10 25 C 6 42, 34 46, 58 25 Z" fill={tie.color} />
                <path d="M 62 25 C 86 4, 114 8, 110 25 C 114 42, 86 46, 62 25 Z" fill={tie.color} />
                <path d="M 54 27 C 46 40, 40 46, 34 50 L 46 50 C 52 44, 56 36, 58 29 Z" fill={tie.shade} />
                <path d="M 66 27 C 74 40, 80 46, 86 50 L 74 50 C 68 44, 64 36, 62 29 Z" fill={tie.shade} />
                <rect x="54" y="18" width="12" height="15" rx="4" fill={tie.shade} />
              </svg>
            ) : null}
          </div>
        </div>
      </div>

      {note ? <p className="block-body">{note}</p> : null}

      {meanings.length ? (
        <p className="bouquet-meanings">
          {stems.length ? `${stems.length} ${stems.length === 1 ? "stem" : "stems"}` : "greenery only"}
          {greenery.length ? ` · ${greenery.length} leaf${greenery.length === 1 ? "" : "s"}` : ""} ·{" "}
          {meanings.join(" · ")}
        </p>
      ) : null}
    </>
  );
}
