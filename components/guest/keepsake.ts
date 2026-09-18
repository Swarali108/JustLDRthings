import type { GuestItem } from "@/lib/guest-share";

/**
 * Builds the file a guest downloads: one self-contained .html page.
 *
 * Self-contained is the whole requirement. Someone who saves this to their
 * laptop must still be able to open it in five years with no network, no
 * account, and no JustLDRthings — so the CSS is inlined and any photo or audio
 * is embedded as a data URI. Nothing in the file points back at us.
 */

/** Above this, embedding the media as a data URI produces a file too big to be useful. */
export const KEEPSAKE_MEDIA_LIMIT = 4 * 1024 * 1024;

export interface KeepsakeBlock {
  kind: "paper" | "song" | "coupon" | "media" | "voice";
  title?: string;
  body?: string;
  paper?: string;
  url?: string;
  note?: string;
  couponText?: string;
  expiresAt?: string | null;
  caption?: string;
  transcript?: string;
  mediaDataUrl?: string;
  mediaKind?: "image" | "video" | "audio";
}

/** Escape for HTML text and quoted attributes alike. */
function esc(value: string | undefined | null): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const PAPERS: Record<string, string> = {
  cream: "background:#f7f3ef;color:#211622;",
  blue: "background:#e7eef7;color:#211622;",
  plum: "background:#43182c;color:#f7f3ef;"
};

function renderBlock(block: KeepsakeBlock): string {
  switch (block.kind) {
    case "paper":
      return `<article class="block" style="${PAPERS[block.paper || "cream"] || PAPERS.cream}">
  ${block.title ? `<h3>${esc(block.title)}</h3>` : ""}
  <p class="body">${esc(block.body)}</p>
</article>`;

    case "song":
      // Only http(s) reaches here (the creator validates the host), but the
      // keepsake escapes it anyway — this file may be opened anywhere.
      return `<article class="block song">
  <div class="art">&#9834;</div>
  <div>
    <strong>${esc(block.title || "A song for you")}</strong>
    ${block.note ? `<p>${esc(block.note)}</p>` : ""}
    <a href="${esc(block.url)}" target="_blank" rel="noreferrer noopener">Listen &#9834;</a>
  </div>
</article>`;

    case "coupon":
      return `<article class="block coupon">
  <span class="tag">Love Coupon</span>
  <strong>${esc(block.couponText || block.title)}</strong>
  <span class="dash"></span>
  <small>${block.expiresAt ? `Good until ${esc(new Date(block.expiresAt).toLocaleDateString())}` : "Redeem any time &#9825;"}</small>
</article>`;

    case "media": {
      const media = block.mediaDataUrl
        ? block.mediaKind === "video"
          ? `<video src="${esc(block.mediaDataUrl)}" controls></video>`
          : `<img src="${esc(block.mediaDataUrl)}" alt="${esc(block.title || "A shared photo")}">`
        : `<p class="missing">This photo was too large to tuck into the file.</p>`;
      return `<article class="block media">
  ${block.title ? `<h3>${esc(block.title)}</h3>` : ""}
  <div class="frame">${media}</div>
  ${block.caption ? `<p class="caption">${esc(block.caption)}</p>` : ""}
</article>`;
    }

    case "voice":
      return `<article class="block voice">
  <strong>${esc(block.title || "A voice note")}</strong>
  ${
    block.mediaDataUrl
      ? `<audio src="${esc(block.mediaDataUrl)}" controls></audio>`
      : `<p class="missing">This clip was too large to tuck into the file.</p>`
  }
  ${block.transcript ? `<p class="transcript">&ldquo;${esc(block.transcript)}&rdquo;</p>` : ""}
</article>`;
  }
}

export function buildKeepsakeHtml(title: string, blocks: KeepsakeBlock[]): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} &#9825;</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 40px 20px 64px;
    background: linear-gradient(180deg,#e7eef7 0%,#f7f3ef 55%,#f7f3ef 100%);
    color: #211622;
    font: 16px/1.6 ui-serif, Georgia, "Times New Roman", serif;
  }
  .wrap { max-width: 640px; margin: 0 auto; }
  header { text-align: center; margin-bottom: 36px; }
  .script { font-style: italic; color: #8c657c; font-size: 1.15rem; margin: 0 0 6px; }
  h1 { font-size: 2rem; margin: 0; color: #43182c; font-weight: 600; }
  .block {
    border-radius: 18px; padding: 24px 26px; margin: 0 0 22px;
    box-shadow: 0 18px 50px rgba(45,21,37,.14);
    background: #fcfaf8;
  }
  .block h3 { margin: 0 0 10px; font-size: 1.15rem; }
  .body { margin: 0; white-space: pre-wrap; }
  .song { display: flex; gap: 18px; align-items: center; }
  .song .art {
    width: 58px; height: 58px; flex: none; border-radius: 14px;
    display: grid; place-items: center; font-size: 1.5rem;
    background: #43182c; color: #f7f3ef;
  }
  .song p { margin: 4px 0 10px; color: #521b38; }
  .song a, .coupon small { color: #6a2147; }
  .coupon { text-align: center; background: #f7f3ef; border: 2px dashed #8c657c; }
  .coupon .tag {
    display: inline-block; margin-bottom: 10px; padding: 4px 12px; border-radius: 999px;
    background: #43182c; color: #f7f3ef; font-size: .72rem; letter-spacing: .09em;
    text-transform: uppercase; font-family: ui-sans-serif, system-ui, sans-serif;
  }
  .coupon strong { display: block; font-size: 1.2rem; }
  .coupon .dash { display: block; border-top: 1px dashed #8c657c; margin: 16px 0; }
  .frame { border-radius: 14px; overflow: hidden; background: #e7eef7; }
  .frame img, .frame video { display: block; width: 100%; height: auto; }
  .caption, .transcript { margin: 12px 0 0; font-style: italic; color: #521b38; }
  .missing { color: #8c657c; font-style: italic; margin: 0; padding: 20px; text-align: center; }
  audio { width: 100%; margin-top: 12px; }
  footer { text-align: center; margin-top: 40px; color: #8c657c; font-size: .85rem; }
  @media print { body { background: #fff; } .block { box-shadow: none; border: 1px solid #e7eef7; } }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <p class="script">For You &#9825;</p>
      <h1>${esc(title)}</h1>
    </header>
    ${blocks.map(renderBlock).join("\n    ")}
    <footer>Made with little things &middot; JustLDRthings &#9825;</footer>
  </div>
</body>
</html>`;
}

/** Turn a shareable guest item into its keepsake equivalent. */
export function guestItemToBlock(item: GuestItem): KeepsakeBlock {
  const p = item.payload;
  switch (item.type) {
    case "note":
    case "letter":
      return { kind: "paper", title: item.title, body: p.body, paper: p.paper };
    case "song":
      return { kind: "song", title: item.title, url: p.url, note: p.note };
    case "coupon":
      return {
        kind: "coupon",
        title: item.title,
        couponText: item.coupon?.coupon_text,
        expiresAt: item.coupon?.expires_at ?? null
      };
  }
}

/** Filesystem-safe filename from a title. */
export function keepsakeFilename(title: string): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "little-thing";
  return `${base}.html`;
}

/** Hand the file to the browser. Revoking on the next tick keeps Safari happy. */
export function downloadHtml(filename: string, html: string): void {
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Read a File/Blob as a data URI, or null if it exceeds the embed limit. */
export function readAsDataUrl(file: Blob): Promise<string | null> {
  if (file.size > KEEPSAKE_MEDIA_LIMIT) return Promise.resolve(null);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
