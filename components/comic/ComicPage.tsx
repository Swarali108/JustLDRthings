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
  redrawing
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
}) {
  const { cols } = gridFor(storyboard.panels.length);

  return (
    <figure className="comic-page">
      <h3 className="comic-page-title">{storyboard.title}</h3>

      <div
        className="comic-page-grid"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {storyboard.panels.map((panel, i) => (
          <div key={i} className="comic-cell">
            {images[i] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={images[i]} alt={panel.scene} className="cell-art" />
            ) : (
              <span className="cell-missing">This panel didn&apos;t draw</span>
            )}

            {/*
              One panel is redrawn on its own for about $0.04. Redrawing the
              whole page to fix one panel pays again for every panel that was
              already right, so this button is the difference between a cheap
              correction and an expensive one.
            */}
            {onRedraw ? (
              <button
                type="button"
                className="cell-redraw"
                onClick={() => onRedraw(i)}
                disabled={redrawing !== null && redrawing !== undefined}
                title={`Redraw only panel ${i + 1} (about $0.04)`}
              >
                {redrawing === i ? "…" : images[i] ? "Redraw" : "Try again"}
              </button>
            ) : null}

            <div className="cell-text">
              {panel.caption ? <span className="cell-caption">{panel.caption}</span> : null}

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
            </div>
          </div>
        ))}
      </div>
    </figure>
  );
}
