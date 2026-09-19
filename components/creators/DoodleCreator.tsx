"use client";

import { useActionState, useState } from "react";
import { saveDoodle, type CreateState } from "@/app/create/actions";
import { doodleSchema, doodleWeight, DOODLE_LINK_BUDGET, type Doodle } from "@/lib/doodle";
import { DEFAULT_STYLE, styleClasses, tiltStyle, type ItemStyle } from "@/lib/style";
import { StylePanel } from "@/components/creators/StylePanel";
import { DoodleCanvas } from "@/components/creators/DoodleCanvas";
import { DoodleView } from "@/components/scrapbook/DoodleView";
import { GuestResult } from "@/components/guest/GuestResult";
import { guestItemToBlock, type KeepsakeBlock } from "@/components/guest/keepsake";
import type { GuestItem, GuestPayload } from "@/lib/guest-share";

const initial: CreateState = {};

interface GuestDone {
  title: string;
  payload: GuestPayload;
  blocks: KeepsakeBlock[];
}

export function DoodleCreator({ signedIn }: { signedIn: boolean }) {
  const [state, formAction, pending] = useActionState(saveDoodle, initial);

  const [doodle, setDoodle] = useState<Doodle>({ strokes: [], paper: 0 });
  const [note, setNote] = useState("");
  const [style, setStyle] = useState<ItemStyle>(DEFAULT_STYLE);
  const [guest, setGuest] = useState<GuestDone | null>(null);
  const [error, setError] = useState("");

  function onGuestSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const parsed = doodleSchema.safeParse(doodle);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    const title = String(form.get("title") || "") || "A little doodle";
    const item: GuestItem = {
      type: "doodle",
      title,
      payload: {
        doodle: parsed.data,
        note: String(form.get("note") || ""),
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

  const formProps = signedIn ? { action: formAction } : { onSubmit: onGuestSubmit };
  const shownError = signedIn ? state.error : error;
  const weight = doodle.strokes.length ? doodleWeight(doodle) : 0;
  const heavy = weight > DOODLE_LINK_BUDGET;

  return (
    <>
      <form {...formProps} className="studio-panel">
        <input type="hidden" name="style" value={JSON.stringify(style)} />
        <input type="hidden" name="doodle" value={JSON.stringify(doodle)} />

        <div className="field">
          <label htmlFor="title">Title (optional)</label>
          <input id="title" name="title" placeholder="A little doodle" />
        </div>

        <div className="field">
          <label>Draw</label>
          <p style={{ color: "var(--mauve)", fontSize: "0.85rem", margin: "2px 0 0" }}>
            Use a finger, a pen or the mouse. Nothing here is saved until you
            finish it.
          </p>
          <DoodleCanvas value={doodle} onChange={setDoodle} />
        </div>

        <div className="field">
          <label htmlFor="note">A line to go with it (optional)</label>
          <textarea
            id="note"
            name="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Drew this thinking of you…"
          />
        </div>

        <div className="field">
          <label>Dress it up</label>
          <StylePanel value={style} onChange={setStyle} />
        </div>

        {heavy && !signedIn ? (
          <p className="form-notice">
            This one&apos;s getting detailed ({weight.toLocaleString()} characters).
            It&apos;ll still send, but the link will be long — simpler drawings
            travel better, or sign in for a short link.
          </p>
        ) : null}

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
              {style.stickers.length ? (
                <span className="sticker-layer" aria-hidden>
                  {style.stickers.map((s, i) => (
                    <span key={s} className={`sticker sticker-${i}`}>
                      {s}
                    </span>
                  ))}
                </span>
              ) : null}
              {doodle.strokes.length ? (
                <>
                  <DoodleView doodle={doodle} />
                  {note ? <p className="block-body">{note}</p> : null}
                </>
              ) : (
                <span className="paper-placeholder">Your drawing shows here ♡</span>
              )}
            </div>
          </div>
          {doodle.strokes.length ? (
            <p style={{ color: "var(--mauve)", fontSize: "0.82rem", marginTop: 12 }}>
              {doodle.strokes.length} stroke{doodle.strokes.length === 1 ? "" : "s"} ·{" "}
              {weight.toLocaleString()} characters
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}
