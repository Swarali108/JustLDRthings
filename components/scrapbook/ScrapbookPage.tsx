import { ItemBlock, type RenderItem } from "@/components/scrapbook/ItemBlock";

/**
 * The recipient-facing "For You" experience. Used by both the owner preview and
 * the shared recipient route. The opening reveal is CSS-only and is disabled
 * under prefers-reduced-motion.
 */
export function ScrapbookPage({
  title,
  items,
  token
}: {
  title: string;
  items: RenderItem[];
  token?: string;
}) {
  return (
    <main className="recipient">
      <header className="reveal-hero">
        <p className="script-lg">For You ♡</p>
        <h1>{title}</h1>
      </header>

      {items.length === 0 ? (
        <p className="empty-line" style={{ textAlign: "center" }}>
          This page is still being written. ♡
        </p>
      ) : (
        <div className="scrapbook-stack">
          {items.map((item, i) => (
            <div
              key={item.id}
              className="reveal-item"
              style={{ animationDelay: `${Math.min(i, 8) * 90}ms` }}
            >
              <ItemBlock item={item} token={token} />
            </div>
          ))}
        </div>
      )}

      <footer className="recipient-foot">
        Made with little things · JustLDRthings ♡
      </footer>
    </main>
  );
}
