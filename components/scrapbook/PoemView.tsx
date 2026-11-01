import { DETAIL_LABELS, type Poem } from "@/lib/poem";

/**
 * A poem on the page.
 *
 * `white-space: pre-wrap` on the body, because line breaks and stanza breaks
 * are the poem — collapsing them the way HTML normally does would destroy the
 * form the user picked.
 *
 * Presentational and server-renderable: nothing here needs the browser.
 */
export function PoemView({ poem, showDetails = false }: { poem: Poem; showDetails?: boolean }) {
  return (
    <div className={`poem poem-${poem.form}`}>
      <h3 className="poem-title">{poem.title}</h3>
      <p className="poem-body">{poem.body}</p>

      {showDetails && poem.used.length > 0 ? (
        <div className="poem-used">
          <span className="poem-used-label">Woven in</span>
          <ul>
            {poem.used.map((d, i) => (
              <li key={`${d.kind}-${i}`}>
                <em>{DETAIL_LABELS[d.kind]}</em> {d.value}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
