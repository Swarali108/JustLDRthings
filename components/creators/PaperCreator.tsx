"use client";

import { useActionState, useState } from "react";
import { saveNote, saveLetter, type CreateState } from "@/app/create/actions";
import { noteSchema, letterSchema } from "@/lib/validation";
import { DEFAULT_PAPER, paperStyle, type PaperChoice } from "@/lib/paper";
import { ENVELOPES, ENVELOPE_SKINS, SEALS, type EnvelopeId, type Seal } from "@/lib/envelope";
import { AiAssist } from "@/components/creators/AiAssist";
import { DEFAULT_STYLE, styleClasses, tiltStyle, type ItemStyle } from "@/lib/style";
import { StylePanel } from "@/components/creators/StylePanel";
import { PaperPicker } from "@/components/creators/PaperPicker";
import { EnvelopeView } from "@/components/scrapbook/EnvelopeView";
import { GuestResult } from "@/components/guest/GuestResult";
import { guestItemToBlock, type KeepsakeBlock } from "@/components/guest/keepsake";
import type { GuestItem, GuestPayload } from "@/lib/guest-share";

const initial: CreateState = {};

interface GuestDone {
  title: string;
  payload: GuestPayload;
  blocks: KeepsakeBlock[];
}

export function PaperCreator({
  kind,
  signedIn
}: {
  kind: "note" | "letter";
  signedIn: boolean;
}) {
  const action = kind === "note" ? saveNote : saveLetter;
  const [state, formAction, pending] = useActionState(action, initial);

  const [body, setBody] = useState("");
  const [paper, setPaper] = useState<PaperChoice>(DEFAULT_PAPER);
  const [envelope, setEnvelope] = useState<EnvelopeId>("cream");
  const [seal, setSeal] = useState<Seal>("♡");
  const [sealed, setSealed] = useState(kind === "letter");
  const [style, setStyle] = useState<ItemStyle>(DEFAULT_STYLE);
  const [guest, setGuest] = useState<GuestDone | null>(null);
  const [guestError, setGuestError] = useState("");

  function onGuestSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const schema = kind === "note" ? noteSchema : letterSchema;
    const parsed = schema.safeParse({
      title: form.get("title") ?? "",
      body: form.get("body") ?? "",
      paper,
      style,
      ...(kind === "letter" ? { sealed, envelope, seal } : {})
    });

    if (!parsed.success) {
      setGuestError(parsed.error.issues[0].message);
      return;
    }

    const title = parsed.data.title || (kind === "note" ? "A little note" : "A letter");
    const item: GuestItem = {
      type: kind,
      title,
      payload: {
        body: parsed.data.body,
        paper: parsed.data.paper,
        style,
        ...(kind === "letter" ? { sealed, envelope, seal } : {})
      }
    };

    setGuestError("");
    setGuest({
      title,
      payload: { v: 1, title, items: [item] },
      blocks: [guestItemToBlock(item)]
    });
  }

  const formProps = signedIn ? { action: formAction } : { onSubmit: onGuestSubmit };
  const error = signedIn ? state.error : guestError;

  const sheet = (
    <div className="paper-sheet" style={paperStyle(paper.color, paper.pattern)}>
      <div className={`paper-inner pattern-${paper.pattern}`}>
        {body ? body : <span className="paper-placeholder">Your words appear here ♡</span>}
      </div>
    </div>
  );

  return (
    <>
      <form {...formProps} className="studio-panel">
        <input type="hidden" name="style" value={JSON.stringify(style)} />
        <input type="hidden" name="paper" value={JSON.stringify(paper)} />
        {kind === "letter" ? (
          <>
            <input type="hidden" name="sealed" value={sealed ? "1" : ""} />
            <input type="hidden" name="envelope" value={envelope} />
            <input type="hidden" name="seal" value={seal} />
          </>
        ) : null}

        <div className="field">
          <label htmlFor="title">Title (optional)</label>
          <input
            id="title"
            name="title"
            placeholder={kind === "note" ? "A little note" : "A letter"}
          />
        </div>

        <div className="field">
          <label htmlFor="body">{kind === "note" ? "Your note" : "Your letter"}</label>
          <textarea
            id="body"
            name="body"
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            style={{ minHeight: kind === "letter" ? 280 : 140 }}
            placeholder={
              kind === "note"
                ? "Leave a tiny thought for their day…"
                : "For everything too big for a text…"
            }
          />
          {signedIn ? <AiAssist kind={kind} onResult={(text) => setBody(text)} /> : null}
        </div>

        <div className="field">
          <label>Paper</label>
          <PaperPicker value={paper} onChange={setPaper} />
        </div>

        {kind === "letter" ? (
          <div className="field">
            <label>Envelope</label>
            <p style={{ color: "var(--mauve)", fontSize: "0.85rem", margin: "2px 0 0" }}>
              Send it sealed and they&apos;ll have to open it before they can read
              it.
            </p>

            <div className="style-row">
              <button
                type="button"
                className="style-chip"
                aria-pressed={sealed}
                onClick={() => setSealed(true)}
              >
                Sealed envelope
              </button>
              <button
                type="button"
                className="style-chip"
                aria-pressed={!sealed}
                onClick={() => setSealed(false)}
              >
                Open letter
              </button>
            </div>

            {sealed ? (
              <>
                <span className="style-legend">Envelope colour</span>
                <div className="style-row">
                  {ENVELOPES.map((id) => (
                    <button
                      key={id}
                      type="button"
                      className="style-chip wrap-chip"
                      aria-pressed={envelope === id}
                      onClick={() => setEnvelope(id)}
                    >
                      <span
                        className="wrap-swatch"
                        style={{ background: ENVELOPE_SKINS[id].body }}
                      />
                      {ENVELOPE_SKINS[id].label}
                    </button>
                  ))}
                </div>

                <span className="style-legend">Wax seal</span>
                <div className="style-row">
                  {SEALS.map((glyph) => (
                    <button
                      key={glyph}
                      type="button"
                      className="style-chip sticker-chip"
                      aria-pressed={seal === glyph}
                      onClick={() => setSeal(glyph)}
                      aria-label={`Seal ${glyph}`}
                    >
                      {glyph}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="field">
          <label>Dress it up</label>
          <StylePanel value={style} onChange={setStyle} />
        </div>

        {error ? (
          <p className="form-error" role="alert">
            {error}
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
              {kind === "letter" && sealed ? (
                // Keyed on the envelope so changing it re-seals the preview —
                // otherwise you open it once and never see your own choices.
                <EnvelopeView
                  key={`${envelope}-${seal}`}
                  envelope={envelope}
                  seal={seal}
                  label="Preview"
                >
                  {sheet}
                </EnvelopeView>
              ) : (
                sheet
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
