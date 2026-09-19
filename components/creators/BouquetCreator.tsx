"use client";

import { useActionState, useState } from "react";
import { saveBouquet, type CreateState } from "@/app/create/actions";
import { bouquetSchema } from "@/lib/validation";
import {
  FLOWERS,
  FLOWER_BY_ID,
  MAX_STEMS,
  GREENERY,
  MAX_GREENERY,
  WRAPS,
  RIBBONS,
  arrangementMeanings
} from "@/lib/flowers";
import { DEFAULT_STYLE, styleClasses, tiltStyle, type ItemStyle } from "@/lib/style";
import { StylePanel } from "@/components/creators/StylePanel";
import { GuestResult } from "@/components/guest/GuestResult";
import { guestItemToBlock, type KeepsakeBlock } from "@/components/guest/keepsake";
import { BouquetView } from "@/components/scrapbook/BouquetView";
import type { GuestItem, GuestPayload } from "@/lib/guest-share";

const initial: CreateState = {};

interface GuestDone {
  title: string;
  payload: GuestPayload;
  blocks: KeepsakeBlock[];
}

export function BouquetCreator({ signedIn }: { signedIn: boolean }) {
  const [state, formAction, pending] = useActionState(saveBouquet, initial);

  // Stems are an ordered list, not a set: picking rose twice puts two roses in.
  const [stems, setStems] = useState<string[]>([]);
  const [greens, setGreens] = useState<string[]>([]);
  const [wrap, setWrap] = useState("cream");
  const [ribbon, setRibbon] = useState("none");
  const [note, setNote] = useState("");
  const [style, setStyle] = useState<ItemStyle>(DEFAULT_STYLE);
  const [guest, setGuest] = useState<GuestDone | null>(null);
  const [error, setError] = useState("");

  function addStem(id: string) {
    if (stems.length >= MAX_STEMS) return;
    setStems([...stems, id]);
  }

  function removeLast(id: string) {
    const idx = stems.lastIndexOf(id);
    if (idx === -1) return;
    setStems(stems.filter((_, i) => i !== idx));
  }

  function build(form: FormData) {
    return bouquetSchema.safeParse({
      title: form.get("title") ?? "",
      stems,
      greenery: greens,
      wrap,
      ribbon,
      note: form.get("note") ?? "",
      style
    });
  }

  function onGuestSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = build(new FormData(event.currentTarget));
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    const title = parsed.data.title || "A bouquet for you";
    const item: GuestItem = {
      type: "bouquet",
      title,
      payload: {
        stems: parsed.data.stems,
        greenery: parsed.data.greenery,
        wrap: parsed.data.wrap,
        ribbon: parsed.data.ribbon,
        note: parsed.data.note,
        style
      }
    };

    setError("");
    setGuest({
      title,
      payload: { v: 1, title, items: [item] },
      blocks: [guestItemToBlock(item)]
    });
  }

  // The signed-in path posts through a hidden field, since stems live in state
  // rather than in a form control.
  const formProps = signedIn ? { action: formAction } : { onSubmit: onGuestSubmit };
  const shownError = signedIn ? state.error : error;
  const meanings = arrangementMeanings(stems, greens);

  return (
    <>
      <form {...formProps} className="studio-panel">
        <div className="field">
          <label htmlFor="title">Title (optional)</label>
          <input id="title" name="title" placeholder="A bouquet for you" />
        </div>

        <input type="hidden" name="stems" value={stems.join(",")} />
        <input type="hidden" name="greenery" value={greens.join(",")} />
        <input type="hidden" name="wrap" value={wrap} />
        <input type="hidden" name="ribbon" value={ribbon} />
        <input type="hidden" name="style" value={JSON.stringify(style)} />

        <div className="field">
          <label>
            Pick your flowers{" "}
            <span className="sty-muted" style={{ fontWeight: 400 }}>
              ({stems.length}/{MAX_STEMS})
            </span>
          </label>
          <p style={{ color: "var(--mauve)", fontSize: "0.85rem", margin: "2px 0 0" }}>
            Tap to add a stem. Tap a picked flower again to take one out.
          </p>
          <div className="bouquet-pick">
            {FLOWERS.map((flower) => {
              const count = stems.filter((s) => s === flower.id).length;
              return (
                <button
                  key={flower.id}
                  type="button"
                  className="bouquet-option"
                  aria-pressed={count > 0}
                  aria-label={`${flower.label} — ${flower.meaning}${count ? `, ${count} picked` : ""}`}
                  onClick={(e) => (e.shiftKey ? removeLast(flower.id) : addStem(flower.id))}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    removeLast(flower.id);
                  }}
                >
                  <span className="bloom" style={{ background: flower.color }} />
                  <strong>
                    {flower.label}
                    {count > 1 ? ` ×${count}` : ""}
                  </strong>
                  <small>{flower.meaning}</small>
                </button>
              );
            })}
          </div>
          {stems.length ? (
            <div className="row-actions" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="button button-light"
                onClick={() => setStems(stems.slice(0, -1))}
              >
                Undo last stem
              </button>
              <button type="button" className="button button-light" onClick={() => setStems([])}>
                Clear
              </button>
            </div>
          ) : null}
        </div>

        <div className="field">
          <label>
            Greenery{" "}
            <span className="sty-muted" style={{ fontWeight: 400 }}>
              ({greens.length}/{MAX_GREENERY})
            </span>
          </label>
          <div className="bouquet-pick">
            {GREENERY.map((sprig) => {
              const count = greens.filter((g) => g === sprig.id).length;
              return (
                <button
                  key={sprig.id}
                  type="button"
                  className="bouquet-option"
                  aria-pressed={count > 0}
                  aria-label={`${sprig.label} — ${sprig.meaning}`}
                  onClick={() =>
                    greens.length < MAX_GREENERY && setGreens([...greens, sprig.id])
                  }
                  onContextMenu={(e) => {
                    e.preventDefault();
                    const idx = greens.lastIndexOf(sprig.id);
                    if (idx !== -1) setGreens(greens.filter((_, i) => i !== idx));
                  }}
                >
                  <span
                    className={`bloom sprig-swatch sprig-${sprig.shape}`}
                    style={{ background: sprig.color }}
                  />
                  <strong>
                    {sprig.label}
                    {count > 1 ? ` ×${count}` : ""}
                  </strong>
                  <small>{sprig.meaning}</small>
                </button>
              );
            })}
          </div>
          {greens.length ? (
            <div className="row-actions" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="button button-light"
                onClick={() => setGreens(greens.slice(0, -1))}
              >
                Undo last sprig
              </button>
              <button type="button" className="button button-light" onClick={() => setGreens([])}>
                Clear greenery
              </button>
            </div>
          ) : null}
        </div>

        <div className="field">
          <label>Wrapping paper</label>
          <div className="style-row">
            {WRAPS.map((paper) => (
              <button
                key={paper.id}
                type="button"
                className="style-chip wrap-chip"
                aria-pressed={wrap === paper.id}
                onClick={() => setWrap(paper.id)}
              >
                <span className="wrap-swatch" style={{ background: paper.background }} />
                {paper.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Ribbon</label>
          <div className="style-row">
            {RIBBONS.map((tie) => (
              <button
                key={tie.id}
                type="button"
                className="style-chip wrap-chip"
                aria-pressed={ribbon === tie.id}
                onClick={() => setRibbon(tie.id)}
              >
                {tie.id !== "none" ? (
                  <span className="wrap-swatch" style={{ background: tie.color }} />
                ) : null}
                {tie.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="note">A line to go with it (optional)</label>
          <textarea
            id="note"
            name="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Picked these because they're you…"
          />
        </div>

        <div className="field">
          <label>Dress it up</label>
          <StylePanel value={style} onChange={setStyle} />
        </div>

        {shownError ? (
          <p className="form-error" role="alert">
            {shownError}
          </p>
        ) : null}

        <div className="row-actions" style={{ marginTop: 16 }}>
          <button type="submit" className="button button-plum" disabled={pending}>
            {signedIn ? (pending ? "Saving…" : "Save this") : "Finish this ♡"}
          </button>
        </div>
      </form>

      {guest ? (
        <GuestResult
          title={guest.title}
          payload={guest.payload}
          blocks={guest.blocks}
          onEdit={() => setGuest(null)}
        />
      ) : (
        <div className="studio-panel">
          <p className="eyebrow">Preview</p>
          <div className={styleClasses(style)}>
            <div className="styled-block" style={tiltStyle(style)}>
              <BouquetView
                stems={stems}
                greenery={greens}
                wrap={wrap}
                ribbon={ribbon}
                note={note}
                meanings={meanings}
                stickers={style.stickers}
              />
              {stems.length === 0 && greens.length === 0 ? (
                <span className="paper-placeholder">Your bouquet comes together here ♡</span>
              ) : null}
            </div>
          </div>
          {stems.length ? (
            <p style={{ color: "var(--mauve)", fontSize: "0.85rem", marginTop: 12 }}>
              {stems.map((s) => FLOWER_BY_ID[s]?.label).filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}
