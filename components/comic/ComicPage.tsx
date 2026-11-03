import { gridFor, type Storyboard } from "@/lib/photo-comic";

/**
 * The finished comic: drawn panels in a grid, with real text over each one.
 *
 * The image model draws beautifully and spells terribly — a test page came back
 * with "Hours pase, still on call" and "First light for B. it sume up her side
 * before mine". Asking it to draw the words at all is asking for that.
 *
 * So every panel arrives deliberately wordless and the dialogue is positioned
 * here as HTML. The lettering is therefore always correct, stays editable after
 * the expensive part is done, and can be restyled without paying to redraw.
 *
 * The grid is composed HERE rather than by the model, and that is not a
 * preference. Asked for "exactly 4 panels, 2 by 2, no insets" the model twice
 * returned 5 panels with a sub-panel and an outer margin. Overlaying text onto
 * a layout it invents cannot work; one image per panel makes the geometry ours.
 */
export function ComicPage({
  images,
  storyboard,
  names,
  onRedraw,
  redrawing,
  attempted
}: {
  /** One drawn image per panel, in order. "" marks one that failed. */
  images: string[];
  storyboard: Storyboard;
  names?: { a: string; b: string };
  /**
   * Redraw a single panel. Optional because this component also renders saved
   * and shared comics, where there is nothing to redraw and no key to spend.
   */
  onRedraw?: (index: number) => void;
  /** Index currently being redrawn, if any. */
  redrawing?: number | null;
  /**
   * Which panels have actually been sent to the illustrator.
   *
   * Without this a panel nobody asked for yet looks exactly like one that was
   * asked for and failed. After drawing a single test panel that meant five
   * cells all announcing "this panel didn't draw", which reads as five errors
   * rather than as work not started.
   */
  attempted?: number[];
}) {
  const { cols } = gridFor(storyboard.panels.length);

  return (
    <figure className="comic-page">
      <h3 className="comic-page-title">{storyboard.title}</h3>

      <div
        className="comic-page-grid"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {storyboard.panels.map((panel, i) => {
          const art = images[i];
          const tried = attempted ? attempted.includes(i) : true;
          const busy = redrawing === i;

          return (
            <div key={i} className={art ? "comic-cell" : "comic-cell comic-cell-empty"}>
              {art ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={art} alt={panel.scene} className="cell-art" />
              ) : (
                <span className="cell-missing">
                  {busy ? "Drawing…" : tried ? "This one didn't draw" : `Panel ${i + 1}`}
                </span>
              )}

              {/*
                Redrawing one panel costs a quarter of what redrawing the page
                costs, so this is the control that matters most — and it used to
                be invisible until the cell was hovered, which on a page of
                undrawn panels meant there appeared to be no way to draw them.
                It is always visible now.
              */}
              {onRedraw ? (
                <button
                  type="button"
                  className="cell-redraw"
                  onClick={() => onRedraw(i)}
                  disabled={typeof redrawing === "number"}
                  title={`Draw panel ${i + 1} again, on its own`}
                >
                  {busy ? "…" : art ? "Redraw" : "Draw this one"}
                </button>
              ) : null}

              {/*
                The words only make sense over a drawing. On an empty cell they
                floated on blank paper and made the page look broken.
              */}
              {art ? (
                <div className="cell-text">
                  <div className="cell-bubbles">
                    {panel.dialogue.map((line, li) => (
                      <span
                        key={li}
                        className={
                          line.speaker === "narrator"
                            ? "bubble bubble-narrator"
                            : line.speaker === "A"
                              ? "bubble bubble-a"
                              : "bubble bubble-b"
                        }
                        title={
                          line.speaker === "narrator"
                            ? undefined
                            : line.speaker === "A"
                              ? names?.a || "You"
                              : names?.b || "Them"
                        }
                      >
                        {line.text}
                      </span>
                    ))}
                  </div>

                  {panel.caption ? (
                    <span className="cell-caption">{panel.caption}</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </figure>
  );
}
