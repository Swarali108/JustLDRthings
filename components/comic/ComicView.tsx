import type { Comic } from "@/lib/comic";
import { ComicPanel } from "@/components/comic/ComicPanel";

/**
 * The whole comic page.
 *
 * Two columns at six panels, two at four, and one at two — so a pair of panels
 * reads as a before/after rather than as a squashed row, and six reads as a
 * proper page. Collapses to one column on a phone, where side-by-side panels
 * would make the dialogue unreadable.
 */
export function ComicView({ comic }: { comic: Comic }) {
  return (
    <figure className={`comic comic-${comic.panels.length}`}>
      <figcaption className="comic-title">{comic.title}</figcaption>
      <div className="comic-grid">
        {comic.panels.map((panel, i) => (
          <ComicPanel key={i} panel={panel} avatars={comic.avatars} index={i} />
        ))}
      </div>
    </figure>
  );
}
