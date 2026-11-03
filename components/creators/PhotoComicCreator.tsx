"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { saveComic, type CreateState } from "@/app/create/actions";
import {
  photoComicSchema,
  storyboardSchema,
  ART_STYLES,
  ART_STYLE_LABELS,
  FREEDOMS,
  FREEDOM_LABELS,
  PANEL_COUNTS,
  MIN_PHOTOS,
  MAX_PHOTOS,
  PHOTO_MAX_EDGE,
  MAX_DIALOGUE_CHARS,
  mergePanels,
  type Storyboard,
  type ArtStyle,
  type Freedom,
  type PanelCount
} from "@/lib/photo-comic";
import { DEFAULT_STYLE, styleClasses, tiltStyle, type ItemStyle } from "@/lib/style";
import { StylePanel } from "@/components/creators/StylePanel";
import { ComicPage } from "@/components/comic/ComicPage";
import { GuestResult } from "@/components/guest/GuestResult";
import { comicToBlocks, type KeepsakeBlock } from "@/components/guest/keepsake";

const initial: CreateState = {};

interface Picked {
  /** For the thumbnail, revoked when removed. */
  objectUrl: string;
  /** Resized and encoded, ready to send. */
  dataUrl: string;
  name: string;
}

/**
 * Shrink a photo in the browser before it is ever sent.
 *
 * Two reasons, and the first is the important one: a 12-megapixel holiday photo
 * carries far more of the original than the illustrator needs, and the less that
 * leaves the device the better. The second is practical — six full-size photos
 * would not fit in a request.
 */
async function resize(file: File): Promise<string> {
  // from-image applies the EXIF rotation. Phone photos carry their orientation
  // as a tag rather than in the pixels, and without this a portrait photo is
  // handed to the illustrator on its side.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  return canvas.toDataURL("image/jpeg", 0.86);
}

export function PhotoComicCreator({ signedIn }: { signedIn: boolean }) {
  const [state, formAction, pending] = useActionState(saveComic, initial);

  const [consent, setConsent] = useState(false);
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [memory, setMemory] = useState("");
  const [panels, setPanels] = useState<PanelCount>(4);
  const [freedom, setFreedom] = useState<Freedom>("balanced");
  const [art, setArt] = useState<ArtStyle>("warm-comic");
  const [names, setNames] = useState({ a: "", b: "" });

  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [drawn, setDrawn] = useState<string[] | null>(null);
  const [spent, setSpent] = useState(0);
  /**
   * The art style the current images were drawn in.
   *
   * Needed to tell "these panels are still missing" apart from "these panels
   * are in a style you have since changed your mind about". Without it, trying
   * one panel, switching style and pressing draw would leave the test panel in
   * the old style in the middle of a page in the new one.
   */
  const [drawnStyle, setDrawnStyle] = useState<ArtStyle | null>(null);
  /**
   * Panels that have actually been sent to the illustrator.
   *
   * An empty slot in `drawn` means "no picture", which covers two very
   * different situations: one nobody has asked for yet, and one that was asked
   * for and came back empty. Only the second is a problem, and conflating them
   * made drawing a single test panel look like five failures.
   */
  const [attempted, setAttempted] = useState<number[]>([]);

  // `panel-N` means that one panel is being redrawn on its own, which needs to
  // be distinguishable from a full draw so only that cell shows as busy.
  const [busy, setBusy] = useState<"" | "reading" | "drawing" | `panel-${number}`>("");
  const [error, setError] = useState("");
  const [style, setStyle] = useState<ItemStyle>(DEFAULT_STYLE);
  const [guest, setGuest] = useState<{ title: string; blocks: KeepsakeBlock[] } | null>(null);

  async function addPhotos(list: FileList | null) {
    setError("");
    if (!list) return;

    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      setError(`That's the most photos one comic takes (${MAX_PHOTOS}).`);
      return;
    }

    const incoming = Array.from(list).slice(0, room);

    // Deliberately NOT gated on file.type. That field is the operating system
    // guessing from the extension, and on Windows it is empty for HEIC/HEIF —
    // the format every recent iPhone shoots — and sometimes for .jfif and
    // .avif too. Checking it rejected photos the picker had just offered.
    // Decoding is the only honest test: if the browser can read it, it is an
    // image, whatever the OS called it.
    const next: Picked[] = [];
    const unreadable: string[] = [];

    for (const file of incoming) {
      try {
        const dataUrl = await resize(file);
        next.push({ objectUrl: URL.createObjectURL(file), dataUrl, name: file.name });
      } catch {
        unreadable.push(file.name);
      }
    }

    if (unreadable.length) {
      // HEIC is worth naming. No browser can decode it, so "try a different
      // photo" is useless advice when every photo on their phone is HEIC.
      const heic = unreadable.some((n) => /\.(heic|heif)$/i.test(n));
      setError(
        heic
          ? "iPhone HEIC photos can't be opened in a browser. On your phone: Settings → Camera → Formats → Most Compatible, or send the photo to yourself to turn it into a JPEG."
          : `Couldn't read ${unreadable.join(", ")}. Try a JPEG or PNG.`
      );
    }

    if (next.length) setPhotos([...photos, ...next]);
  }

  function removePhoto(i: number) {
    const next = [...photos];
    const [gone] = next.splice(i, 1);
    if (gone) URL.revokeObjectURL(gone.objectUrl);
    setPhotos(next);
    // The story was written about a set of photos that no longer exists.
    setStoryboard(null);
    setDrawn(null);
    setAttempted([]);
  }

  async function readPhotos() {
    setError("");
    setBusy("reading");
    // A fresh story means the old drawings belong to a story that no longer
    // exists, so what was attempted for it no longer means anything either.
    setDrawn(null);
    setAttempted([]);
    setDrawnStyle(null);
    try {
      const res = await fetch("/api/ai/comic/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memory,
          photos: photos.map((p) => ({ dataUrl: p.dataUrl })),
          panels,
          freedom,
          names,
          consent: true
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Couldn't read those photos.");
        return;
      }
      const parsed = storyboardSchema.safeParse(data.storyboard);
      if (!parsed.success) {
        setError("That storyboard came back malformed. Try again.");
        return;
      }
      setStoryboard(parsed.data);
      setSpent((s) => s + (data.stats?.costUsd ?? 0));
    } catch {
      setError("Couldn't reach the comic maker.");
    } finally {
      setBusy("");
    }
  }

  /**
   * Draw panels. `only` restricts it to those indexes.
   *
   * This is the one action in the app that spends real money, and the amount
   * scales with how many panels it covers. Redrawing one disappointing panel
   * costs about $0.04; redrawing the whole comic to fix that one panel costs
   * four times as much for three images that were already fine. So results are
   * MERGED into what is already drawn rather than replacing it, which is what
   * makes a single-panel redraw possible at all.
   */
  async function draw(only?: number[]) {
    if (!storyboard) return;
    const requested = only?.length ? only : storyboard.panels.map((_, i) => i);
    setError("");
    setBusy(only?.length === 1 ? `panel-${only[0]}` : "drawing");
    try {
      const res = await fetch("/api/ai/comic/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyboard,
          photos: photos.map((p) => ({ dataUrl: p.dataUrl })),
          style: art,
          names,
          consent: true,
          ...(only?.length ? { only } : {})
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Drawing failed.");
        return;
      }

      setDrawn((prev) => mergePanels(prev, data.images ?? []));
      setSpent((s) => s + (data.stats?.costUsd ?? 0));
      setDrawnStyle(art);
      setAttempted((prev) => Array.from(new Set([...prev, ...requested])));
    } catch {
      setError("Couldn't reach the illustrator.");
    } finally {
      setBusy("");
    }
  }

  /**
   * Which panels the main button should draw.
   *
   * Only the ones that are actually missing — after trying a single panel, the
   * rest of the page costs the rest of the page, not the whole thing again.
   *
   * Unless the style has changed since those panels were drawn, in which case
   * every panel genuinely does need redrawing or the page comes out in two
   * different styles.
   */
  const all = storyboard ? storyboard.panels.map((_, i) => i) : [];
  const missing = drawn ? all.filter((i) => !drawn[i]) : all;
  const styleChanged = Boolean(drawn) && drawnStyle !== art;
  // Nothing missing and the style still matches? Then the button means "do the
  // whole thing over" — the only reading left — rather than going dead.
  const toDraw = styleChanged || missing.length === 0 ? all : missing;

  function editPanel(i: number, patch: Partial<Storyboard["panels"][number]>) {
    if (!storyboard) return;
    const next = [...storyboard.panels];
    next[i] = { ...next[i], ...patch };
    setStoryboard({ ...storyboard, panels: next });
  }

  function editLine(pi: number, li: number, text: string) {
    if (!storyboard) return;
    const dialogue = [...storyboard.panels[pi].dialogue];
    dialogue[li] = { ...dialogue[li], text: text.slice(0, MAX_DIALOGUE_CHARS) };
    editPanel(pi, { dialogue });
  }

  function movePanel(i: number, by: -1 | 1) {
    if (!storyboard) return;
    const to = i + by;
    if (to < 0 || to >= storyboard.panels.length) return;
    const next = [...storyboard.panels];
    [next[i], next[to]] = [next[to], next[i]];
    setStoryboard({ ...storyboard, panels: next });
  }

  function onGuestSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!drawn || !storyboard) {
      setError("Draw the comic first.");
      return;
    }
    const title = storyboard.title || "A little comic";

    // Every drawn panel goes in, in order, each with its own words. A drawn
    // page is about a megabyte per panel, which is why this is a download
    // rather than a link.
    const blocks = comicToBlocks(title, storyboard.panels, drawn, names, style);
    if (blocks.length === 0) {
      setError("There's nothing drawn yet to save.");
      return;
    }

    setGuest({ title, blocks });
  }

  const comicPayload =
    storyboard && drawn
      ? photoComicSchema.safeParse({
          title: storyboard.title,
          storyboard,
          style: art,
          images: drawn
        })
      : null;

  const formProps = signedIn ? { action: formAction } : { onSubmit: onGuestSubmit };
  const shownError = signedIn ? state.error || error : error;
  const enoughPhotos = photos.length >= MIN_PHOTOS;

  // ---- the consent gate ----------------------------------------------------
  if (!consent) {
    return (
      <div className="studio-panel">
        <p className="eyebrow">Before we start</p>
        <h3 style={{ marginTop: 8 }}>Your photos get sent to an AI to be drawn. ♡</h3>

        <p style={{ lineHeight: 1.7, marginTop: 12 }}>
          To draw the two of you, the photos you pick are sent to Google&apos;s
          Gemini model. That is the only way it can make the people in the comic
          look like you.
        </p>

        <ul className="consent-list">
          <li>They are shrunk on your device first, so the full-size originals never leave it.</li>
          <li>This app doesn&apos;t keep them. Only the finished comic is saved, and only if you save it.</li>
          <li>Google&apos;s own handling of them is theirs, not ours — we can&apos;t promise anything about it.</li>
          <li>Don&apos;t use photos of anyone who hasn&apos;t agreed to this.</li>
        </ul>

        <div className="row-actions" style={{ marginTop: 20 }}>
          <button type="button" className="button button-plum" onClick={() => setConsent(true)}>
            I understand — let&apos;s make it
          </button>
          <Link href="/create/doodle" className="button button-light">
            Draw it myself instead
          </Link>
        </div>

        <p style={{ marginTop: 16, color: "var(--mauve)", lineHeight: 1.6 }}>
          Changed your mind later? Nothing is sent until you press &ldquo;Read my
          photos&rdquo;.
        </p>
      </div>
    );
  }

  return (
    <>
      <form {...formProps} className="studio-panel">
        <input type="hidden" name="style" value={JSON.stringify(style)} />
        <input
          type="hidden"
          name="comic"
          value={JSON.stringify(comicPayload?.success ? comicPayload.data : null)}
        />

        <div className="field">
          <label htmlFor="photos">
            Your photos{" "}
            <span className="sty-muted" style={{ fontWeight: 400 }}>
              ({photos.length}/{MAX_PHOTOS})
            </span>
          </label>
          <p style={{ color: "var(--mauve)", fontSize: "0.85rem", margin: "2px 0 0" }}>
            {MIN_PHOTOS} to {MAX_PHOTOS} photos of the two of you. Clear faces
            work best — they&apos;re what the drawing is based on.
          </p>
          <input
            id="photos"
            type="file"
            // The extensions are spelled out as well as image/*, because
            // Windows reports no MIME type for these and would otherwise hide
            // them from the picker entirely — leaving the user looking at a
            // folder that appears empty. They are better selected and
            // explained than invisible.
            accept="image/*,.heic,.heif,.jfif,.avif"
            multiple
            disabled={photos.length >= MAX_PHOTOS}
            onChange={(e) => {
              void addPhotos(e.target.files);
              e.target.value = "";
            }}
          />

          {photos.length ? (
            <div className="photo-strip">
              {photos.map((p, i) => (
                <div key={p.objectUrl} className="photo-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.objectUrl} alt={`Photo ${i + 1}`} />
                  <span className="photo-num">{i + 1}</span>
                  <button
                    type="button"
                    className="collage-remove"
                    aria-label={`Remove photo ${i + 1}`}
                    onClick={() => removePhoto(i)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="memory">What happened</label>
          <textarea
            id="memory"
            value={memory}
            onChange={(e) => setMemory(e.target.value)}
            style={{ minHeight: 120 }}
            placeholder="Her train from Pune was delayed four hours and we stayed on video call the whole night…"
          />
          <small style={{ color: "var(--mauve)" }}>{memory.trim().length}/1500</small>
        </div>

        <div className="field">
          <label>Your names (optional)</label>
          <div className="name-pair">
            <input
              value={names.a}
              onChange={(e) => setNames({ ...names, a: e.target.value })}
              placeholder="You"
              maxLength={24}
              aria-label="Your name"
            />
            <input
              value={names.b}
              onChange={(e) => setNames({ ...names, b: e.target.value })}
              placeholder="Them"
              maxLength={24}
              aria-label="Their name"
            />
          </div>
        </div>

        <div className="field">
          <label>Panels</label>
          <div className="style-row">
            {PANEL_COUNTS.map((n) => (
              <button key={n} type="button" className="style-chip" aria-pressed={panels === n} onClick={() => setPanels(n)}>
                {n}
              </button>
            ))}
          </div>

          <span className="style-legend">How much to invent</span>
          <div className="style-row">
            {FREEDOMS.map((f) => (
              <button key={f} type="button" className="style-chip" aria-pressed={freedom === f} onClick={() => setFreedom(f)}>
                {FREEDOM_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        <div className="row-actions">
          <button
            type="button"
            className="button button-plum"
            onClick={readPhotos}
            disabled={Boolean(busy) || !enoughPhotos || memory.trim().length < 30}
          >
            {busy === "reading" ? "Reading…" : storyboard ? "Rewrite the story" : "Read my photos ♡"}
          </button>
          {!enoughPhotos ? (
            <small style={{ color: "var(--mauve)" }}>Add at least {MIN_PHOTOS} photos.</small>
          ) : null}
        </div>

        {storyboard ? (
          <>
            <div className="field">
              <label>The story</label>
              <p style={{ color: "var(--mauve)", fontSize: "0.85rem", margin: "2px 0 0" }}>
                Get this right before drawing — the drawing is the part that
                costs. Editing here is free.
              </p>

              <input
                className="story-title"
                value={storyboard.title}
                onChange={(e) => setStoryboard({ ...storyboard, title: e.target.value.slice(0, 60) })}
                aria-label="Comic title"
              />

              {storyboard.panels.map((panel, pi) => (
                <div key={pi} className="panel-editor">
                  <div className="title-row">
                    <strong>
                      Panel {pi + 1}
                      {panel.photo !== null ? (
                        <span className="sty-muted"> · from photo {panel.photo + 1}</span>
                      ) : null}
                    </strong>
                    <span className="row-actions">
                      <button type="button" className="icon-button" onClick={() => movePanel(pi, -1)} disabled={pi === 0} aria-label="Move up">↑</button>
                      <button type="button" className="icon-button" onClick={() => movePanel(pi, 1)} disabled={pi === storyboard.panels.length - 1} aria-label="Move down">↓</button>
                    </span>
                  </div>

                  <label className="mini-label">Scene</label>
                  <textarea
                    value={panel.scene}
                    onChange={(e) => editPanel(pi, { scene: e.target.value.slice(0, 220) })}
                    style={{ minHeight: 56 }}
                  />

                  {panel.dialogue.map((line, li) => (
                    <div key={li} className="line-editor">
                      <span className="mini-label">
                        {line.speaker === "narrator"
                          ? "Caption"
                          : line.speaker === "A"
                            ? names.a || "You"
                            : names.b || "Them"}
                      </span>
                      <input
                        value={line.text}
                        maxLength={MAX_DIALOGUE_CHARS}
                        onChange={(e) => editLine(pi, li, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="field">
              <label>Style</label>
              <div className="style-row">
                {ART_STYLES.map((a) => (
                  <button key={a} type="button" className="style-chip" aria-pressed={art === a} onClick={() => setArt(a)}>
                    {ART_STYLE_LABELS[a]}
                  </button>
                ))}
              </div>
            </div>

            {/*
              ONE action at a time. Offering "draw the page" and "try one panel"
              together asked the user to make a judgement about cost before they
              had seen anything the illustrator can do. The first panel comes
              first; the rest of the page is offered once there is something to
              judge it by.
            */}
            <div className="row-actions" style={{ marginTop: 14 }}>
              {!drawn ? (
                <button
                  type="button"
                  className="button button-plum"
                  onClick={() => void draw([0])}
                  disabled={Boolean(busy)}
                >
                  {busy === "panel-0" ? "Drawing…" : "Try one panel first ♡"}
                </button>
              ) : (
                <button
                  type="button"
                  className="button button-plum"
                  onClick={() => void draw(toDraw)}
                  disabled={Boolean(busy)}
                >
                  {busy === "drawing"
                    ? "Drawing…"
                    : toDraw.length < all.length
                      ? `Draw the other ${toDraw.length} ♡`
                      : styleChanged
                        ? "Redraw in this style ♡"
                        : "Draw them all again ♡"}
                </button>
              )}
            </div>

            <small style={{ color: "var(--mauve)", display: "block", marginTop: 6 }}>
              {!drawn
                ? "One panel first, so you can see the style before the rest is drawn. About 15 seconds."
                : "Editing the story above is free. Any panel can be drawn again on its own."}
            </small>

            {busy === "drawing" ? (
              <p className="form-notice">
                Drawing the page. This is the slow part — about half a minute. ♡
              </p>
            ) : null}
          </>
        ) : null}

        {spent > 0 ? (
          <p className="form-notice cost-note">
            This comic has cost about ${spent.toFixed(3)} so far.
          </p>
        ) : null}

        {shownError ? (
          <p className="form-error" role="alert">
            {shownError}
          </p>
        ) : null}

        {drawn ? (
          <>
            <div className="field">
              <label>Dress it up</label>
              <StylePanel value={style} onChange={setStyle} />
            </div>

            {/*
              A part-drawn comic must not be finishable. Asking for six panels,
              drawing one to check the style and then pressing finish produced a
              one-panel comic with no warning at all — the missing five were
              only visible as empty cells in the preview, which is not where
              someone is looking when they press the button that ends the job.
            */}
            {missing.length ? (
              <p className="form-notice" role="status">
                {all.length - missing.length} of {all.length} panels drawn.
                Draw the {missing.length === 1 ? "last one" : `other ${missing.length}`} before finishing,
                or remove {missing.length === 1 ? "it" : "them"} from the story above.
              </p>
            ) : null}

            <div className="row-actions" style={{ marginTop: 16 }}>
              <button
                type="submit"
                className="button button-plum"
                disabled={pending || missing.length > 0 || Boolean(busy)}
              >
                {signedIn ? (pending ? "Saving…" : "Save this") : "Finish this ♡"}
              </button>
            </div>
          </>
        ) : null}
      </form>

      {guest ? (
        <GuestResult
          title={guest.title}
          payload={null}
          blocks={guest.blocks}
          onEdit={() => setGuest(null)}
          unshareableReason="A drawn comic is about a megabyte, too big for a link. Save it to your laptop below, or sign in to share it."
        />
      ) : (
        <div className="studio-panel">
          <p className="eyebrow">Preview</p>
          <div className={styleClasses(style)}>
            <div className="styled-block" style={tiltStyle(style)}>
              {drawn && storyboard ? (
                <ComicPage
                  images={drawn}
                  storyboard={storyboard}
                  names={names}
                  onRedraw={(i) => void draw([i])}
                  redrawing={
                    busy.startsWith("panel-") ? Number(busy.slice(6)) : null
                  }
                  attempted={attempted}
                />
              ) : (
                <span className="paper-placeholder">
                  {storyboard
                    ? "Story's ready — press Draw it ♡"
                    : "Add photos and a memory, then read them ♡"}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
