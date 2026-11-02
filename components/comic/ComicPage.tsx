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
  names
}: {
  /** One drawn image per panel, in order. "" marks one that failed. */
  images: string[];
  storyboard: Storyboard;
  names?: { a: string; b: string };
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
