import type { GuestItem } from "@/lib/guest-share";
import {
  FLOWER_BY_ID,
  GREENERY_BY_ID,
  WRAP_BY_ID,
  RIBBON_BY_ID,
  arrangementMeanings
} from "@/lib/flowers";
import {
  DOODLE_W,
  DOODLE_H,
  strokePath,
  inkColor,
  nibWidth,
  paperColor,
  type Doodle
} from "@/lib/doodle";
import {
  readStyle,
  DEFAULT_STYLE,
  KEEPSAKE_FONTS,
  KEEPSAKE_PALETTES,
  type ItemStyle
} from "@/lib/style";

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
  kind: "paper" | "song" | "coupon" | "media" | "voice" | "bouquet" | "collage" | "doodle";
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
  /** Collage: one data URI per photo, already embedded. */
  collageDataUrls?: string[];
  /** Bouquet: ordered flower ids, plus greenery, wrapping and tie. */
  stems?: string[];
  greenery?: string[];
  wrap?: string;
  ribbon?: string;
  /** Doodle: stroke geometry, rendered as inline SVG. */
  doodle?: Doodle;
  /** Colour, lettering, placement and decorations for this block. */
  style?: ItemStyle;
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

/** Decorations, positioned by index to match the app's .sticker-N rules. */
const STICKER_SPOTS = [
  "top:-6px;left:-8px;transform:rotate(-16deg);",
  "top:-10px;right:-6px;transform:rotate(14deg);",
  "bottom:-8px;right:-10px;transform:rotate(-9deg);",
  "bottom:-6px;left:-6px;transform:rotate(11deg);",
  "top:42%;left:-16px;transform:rotate(-22deg);",
  "top:40%;right:-16px;transform:rotate(18deg);"
];

function renderStickers(style: ItemStyle): string {
  if (!style.stickers.length) return "";
  return style.stickers
    .map(
      (sticker, i) =>
        `<span class="sticker" style="${STICKER_SPOTS[i] || STICKER_SPOTS[0]}">${esc(sticker)}</span>`
    )
    .join("");
}

/** Per-block inline style: the chosen lettering, alignment and tilt. */
function blockAttrs(style: ItemStyle): string {
  const bits = [
    `font-family:${KEEPSAKE_FONTS[style.font]}`,
    `text-align:${style.align}`
  ];
  if (style.tilt) bits.push(`transform:rotate(${style.tilt}deg)`);
  return bits.join(";") + ";";
}

function renderBouquet(block: KeepsakeBlock, style: ItemStyle): string {
  const stems = block.stems || [];
  const blooms = stems
    .map((id, i) => {
      const flower = FLOWER_BY_ID[id];
      if (!flower) return "";
      const size = 34 + ((i * 7) % 3) * 6;
      const lift = ((i * 5) % 4) * 5;
      return `<span class="bloom" style="background:${esc(flower.color)};height:${size}px;width:${size}px;margin-bottom:${lift}px;"></span>`;
    })
    .join("");
  const greens = (block.greenery || [])
    .map((id, i) => {
      const sprig = GREENERY_BY_ID[id];
      if (!sprig) return "";
      const lean = (i - ((block.greenery || []).length - 1) / 2) * 16;
      return `<span class="sprig sprig-${esc(sprig.shape)}" style="background:${esc(sprig.color)};transform:rotate(${lean}deg);"></span>`;
    })
    .join("");

  const paper = WRAP_BY_ID[block.wrap || "cream"] || WRAP_BY_ID.cream;
  const tie = RIBBON_BY_ID[block.ribbon || "none"] || RIBBON_BY_ID.none;
  const ribbon =
    tie.id !== "none" ? `<span class="ribbon" style="background:${esc(tie.color)};"></span>` : "";

  const meanings = arrangementMeanings(stems, block.greenery || []);
  return `<article class="block" style="${blockAttrs(style)}">
  ${renderStickers(style)}
  ${block.title ? `<h3>${esc(block.title)}</h3>` : ""}
  <div class="bouquet">${greens ? `<div class="greens">${greens}</div>` : ""}<div class="blooms">${blooms}</div><div class="cone" style="background:${esc(paper.background)};">${ribbon}</div></div>
  ${block.note ? `<p class="body">${esc(block.note)}</p>` : ""}
  ${meanings.length ? `<p class="meanings">${stems.length} ${stems.length === 1 ? "stem" : "stems"} &middot; ${esc(meanings.join(" \u00b7 "))}</p>` : ""}
</article>`;
}

function renderCollage(block: KeepsakeBlock, style: ItemStyle): string {
  const photos = block.collageDataUrls || [];
  const cells = photos
    .map(
      (url, i) =>
        `<div class="cell"><img src="${esc(url)}" alt="${esc(block.title || "Photo")} ${i + 1}"></div>`
    )
    .join("");
  return `<article class="block" style="${blockAttrs(style)}">
  ${renderStickers(style)}
  ${block.title ? `<h3>${esc(block.title)}</h3>` : ""}
  ${photos.length ? `<div class="collage count-${photos.length}">${cells}</div>` : `<p class="missing">These photos were too large to tuck into the file.</p>`}
  ${block.caption ? `<p class="caption">${esc(block.caption)}</p>` : ""}
</article>`;
}

/**
 * The doodle as inline SVG. Vector, so it stays sharp at any size and prints
 * cleanly — and needs no embedded bitmap, which keeps the file small.
 */
function renderDoodle(block: KeepsakeBlock, style: ItemStyle): string {
  const drawing = block.doodle;
  if (!drawing) return "";

  const paths = drawing.strokes
    .map(
      (stroke) =>
        `<path d="${esc(strokePath(stroke))}" stroke="${esc(inkColor(stroke.c))}" stroke-width="${nibWidth(stroke.w)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    )
    .join("");

  return `<article class="block" style="${blockAttrs(style)}">
  ${renderStickers(style)}
  ${block.title ? `<h3>${esc(block.title)}</h3>` : ""}
  <svg class="doodle" viewBox="0 0 ${DOODLE_W} ${DOODLE_H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="A hand-drawn doodle">
    <rect x="0" y="0" width="${DOODLE_W}" height="${DOODLE_H}" fill="${esc(paperColor(drawing.paper))}"/>
    ${paths}
  </svg>
  ${block.note ? `<p class="body">${esc(block.note)}</p>` : ""}
</article>`;
}

function renderBlock(block: KeepsakeBlock): string {
  const style = block.style || DEFAULT_STYLE;
  if (block.kind === "doodle") return renderDoodle(block, style);
  if (block.kind === "bouquet") return renderBouquet(block, style);
  if (block.kind === "collage") return renderCollage(block, style);

  switch (block.kind) {
    case "paper":
      return `<article class="block" style="${PAPERS[block.paper || "cream"] || PAPERS.cream}${blockAttrs(style)}">
  ${renderStickers(style)}
  ${block.title ? `<h3>${esc(block.title)}</h3>` : ""}
  <p class="body">${esc(block.body)}</p>
</article>`;

    case "song":
      // Only http(s) reaches here (the creator validates the host), but the
      // keepsake escapes it anyway — this file may be opened anywhere.
      return `<article class="block song" style="${blockAttrs(style)}">
  ${renderStickers(style)}
  <div class="art">&#9834;</div>
  <div>
    <strong>${esc(block.title || "A song for you")}</strong>
    ${block.note ? `<p>${esc(block.note)}</p>` : ""}
    <a href="${esc(block.url)}" target="_blank" rel="noreferrer noopener">Listen &#9834;</a>
  </div>
</article>`;

    case "coupon":
      return `<article class="block coupon" style="${blockAttrs(style)}">
  ${renderStickers(style)}
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
      return `<article class="block media" style="${blockAttrs(style)}">
  ${renderStickers(style)}
  ${block.title ? `<h3>${esc(block.title)}</h3>` : ""}
  <div class="frame">${media}</div>
  ${block.caption ? `<p class="caption">${esc(block.caption)}</p>` : ""}
</article>`;
    }

    case "voice":
      return `<article class="block voice" style="${blockAttrs(style)}">
  ${renderStickers(style)}
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
  // The page takes its colour from the first block, matching how the shared
  // page themes itself. Palettes are literal values, not CSS variables from the
  // app, because this file has to render with no stylesheet and no network.
  const pal = KEEPSAKE_PALETTES[(blocks[0]?.style || DEFAULT_STYLE).theme];
  const headingFont = KEEPSAKE_FONTS[(blocks[0]?.style || DEFAULT_STYLE).font];

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
    background: ${pal.pageBg};
    color: ${pal.ink};
    font: 16px/1.6 ${headingFont};
  }
  .wrap { max-width: 640px; margin: 0 auto; }
  header { text-align: center; margin-bottom: 36px; }
  .script { font-style: italic; color: ${pal.accent}; font-size: 1.15rem; margin: 0 0 6px; }
  h1 { font-size: 2rem; margin: 0; color: ${pal.ink}; font-weight: 600; }
  .block {
    border-radius: 18px; padding: 24px 26px; margin: 0 0 22px;
    box-shadow: 0 18px 50px rgba(45,21,37,.14);
    background: ${pal.cardBg};
    border: 1px solid ${pal.border};
    color: ${pal.ink};
    position: relative;
  }
  .sticker { position: absolute; font-size: 1.5rem; line-height: 1; }
  .bouquet { display: flex; flex-direction: column; align-items: center; margin: 8px 0 4px; }
  .blooms {
    display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;
    max-width: 260px; align-items: flex-end;
  }
  .bloom {
    border-radius: 50%;
    box-shadow: inset 0 -4px 10px rgba(45,21,37,.14);
    filter: drop-shadow(0 6px 8px rgba(45,21,37,.16));
    display: inline-block;
  }
  .cone {
    background: repeating-linear-gradient(110deg, rgba(106,33,71,.08) 0 12px, rgba(252,250,248,.95) 13px 26px), #f7f3ef;
    clip-path: polygon(16% 0, 84% 0, 68% 100%, 32% 100%);
    border-radius: 0 0 60px 60px;
    height: 120px; width: 190px; margin-top: -14px;
  }
  .meanings { font-size: .82rem; opacity: .75; margin: 12px 0 0; font-style: italic; }
  .greens { display: flex; justify-content: center; align-items: flex-end; margin-bottom: -18px; }
  .sprig { display: inline-block; width: 10px; height: 74px; border-radius: 50% 50% 40% 40%; opacity: .9; margin: 0 -2px; }
  .sprig-frond { width: 7px; height: 88px; border-radius: 50% 50% 4px 4px; }
  .sprig-spray { width: 16px; height: 56px; border-radius: 50%; opacity: .75; }
  .cone { position: relative; }
  .ribbon { position: absolute; left: 50%; top: 26px; transform: translateX(-50%); width: 74px; height: 12px; border-radius: 6px; }
  .doodle { display: block; width: 100%; height: auto; border-radius: 12px; }
  .collage { display: grid; gap: 6px; grid-template-columns: repeat(2, 1fr); }
  .collage.count-1 { grid-template-columns: 1fr; }
  .collage.count-3 .cell:first-child, .collage.count-5 .cell:first-child { grid-column: span 2; }
  .cell { aspect-ratio: 1; border-radius: 10px; overflow: hidden; }
  .cell img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .block h3 { margin: 0 0 10px; font-size: 1.15rem; }
  .body { margin: 0; white-space: pre-wrap; }
  .song { display: flex; gap: 18px; align-items: center; }
  .song .art {
    width: 58px; height: 58px; flex: none; border-radius: 14px;
    display: grid; place-items: center; font-size: 1.5rem;
    background: #43182c; color: #f7f3ef;
  }
  .song p { margin: 4px 0 10px; color: #521b38; }
  .song a, .coupon small { color: ${pal.accent}; }
  .coupon { text-align: center; border: 2px dashed ${pal.border}; }
  .coupon .tag {
    display: inline-block; margin-bottom: 10px; padding: 4px 12px; border-radius: 999px;
    background: #43182c; color: #f7f3ef; font-size: .72rem; letter-spacing: .09em;
    text-transform: uppercase; font-family: ui-sans-serif, system-ui, sans-serif;
  }
  .coupon strong { display: block; font-size: 1.2rem; }
  .coupon .dash { display: block; border-top: 1px dashed #8c657c; margin: 16px 0; }
  .frame { border-radius: 14px; overflow: hidden; background: #e7eef7; }
  .frame img, .frame video { display: block; width: 100%; height: auto; }
  .caption, .transcript { margin: 12px 0 0; font-style: italic; opacity: .8; }
  .missing { color: #8c657c; font-style: italic; margin: 0; padding: 20px; text-align: center; }
  audio { width: 100%; margin-top: 12px; }
  footer { text-align: center; margin-top: 40px; color: ${pal.accent}; font-size: .85rem; opacity: .8; }
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
  const style = readStyle(p);

  switch (item.type) {
    case "note":
    case "letter":
      return { kind: "paper", title: item.title, body: p.body, paper: p.paper, style };
    case "song":
      return { kind: "song", title: item.title, url: p.url, note: p.note, style };
    case "bouquet":
      return {
        kind: "bouquet",
        title: item.title,
        stems: p.stems || [],
        greenery: p.greenery || [],
        wrap: p.wrap,
        ribbon: p.ribbon,
        note: p.note,
        style
      };
    case "doodle":
      return { kind: "doodle", title: item.title, doodle: p.doodle, note: p.note, style };
    case "coupon":
      return {
        kind: "coupon",
        title: item.title,
        couponText: item.coupon?.coupon_text,
        expiresAt: item.coupon?.expires_at ?? null,
        style
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
