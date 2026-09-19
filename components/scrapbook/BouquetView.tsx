import {
  FLOWER_BY_ID,
  GREENERY_BY_ID,
  WRAP_BY_ID,
  RIBBON_BY_ID
} from "@/lib/flowers";

/**
 * The bouquet: greenery behind, blooms in front, wrapped in paper and tied.
 *
 * Presentational and shared by the creator preview and the recipient page, so
 * what you arrange is exactly what they open. Sizes and offsets come from the
 * item's index, never from randomness — the same bouquet must look identical on
 * every render and on every machine.
 */
export function BouquetView({
  stems,
  greenery = [],
  wrap = "cream",
  ribbon = "none",
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

  const paper = WRAP_BY_ID[wrap] ?? WRAP_BY_ID.cream;
  const tie = RIBBON_BY_ID[ribbon] ?? RIBBON_BY_ID.none;

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
        <div>
          {/* Greenery sits behind the blooms, fanned wider. */}
          {greenery.length ? (
            <div className="bouquet-greens" aria-hidden>
              {greenery.map((id, i) => {
                const sprig = GREENERY_BY_ID[id];
                if (!sprig) return null;
                const lean = (i - (greenery.length - 1) / 2) * 16;
                return (
                  <span
                    key={`${id}-${i}`}
                    className={`sprig sprig-${sprig.shape}`}
                    style={{
                      background: sprig.color,
                      transform: `rotate(${lean}deg)`
                    }}
                  />
                );
              })}
            </div>
          ) : null}

          <div className="bouquet-blooms">
            {stems.map((id, i) => {
              const flower = FLOWER_BY_ID[id];
              if (!flower) return null;
              const size = 34 + ((i * 7) % 3) * 6;
              const lift = ((i * 5) % 4) * 5;
              return (
                <span
                  key={`${id}-${i}`}
                  className="bouquet-bloom"
                  title={`${flower.label} — ${flower.meaning}`}
                  style={{
                    background: flower.color,
                    height: size,
                    width: size,
                    marginBottom: lift
                  }}
                />
              );
            })}
          </div>

          <div className="bouquet-cone" style={{ background: paper.background }} aria-hidden>
            {tie.id !== "none" ? (
              <span className="bouquet-ribbon" style={{ background: tie.color }} />
            ) : null}
          </div>
        </div>
      </div>

      {note ? <p className="block-body">{note}</p> : null}

      {meanings.length ? (
        <p className="bouquet-meanings">
          {stems.length ? `${stems.length} ${stems.length === 1 ? "stem" : "stems"}` : "greenery"}
          {greenery.length ? ` · ${greenery.length} sprig${greenery.length === 1 ? "" : "s"}` : ""} ·{" "}
          {meanings.join(" · ")}
        </p>
      ) : null}
    </>
  );
}
