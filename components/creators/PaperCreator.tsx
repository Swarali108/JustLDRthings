"use client";

import { useActionState, useState } from "react";
import { saveNote, saveLetter, type CreateState } from "@/app/create/actions";
import { PAPER_THEMES, noteSchema, letterSchema } from "@/lib/validation";
import { AiAssist } from "@/components/creators/AiAssist";
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
  const [paper, setPaper] = useState<(typeof PAPER_THEMES)[number]>("cream");
  const [guest, setGuest] = useState<GuestDone | null>(null);
  const [guestError, setGuestError] = useState("");

  /**
   * Guest path: same schema as the server action, run here instead. Nothing is
   * sent anywhere — the result becomes a link and a file, both built in-page.
   */
  function onGuestSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const schema = kind === "note" ? noteSchema : letterSchema;
    const parsed = schema.safeParse({
      title: form.get("title") ?? "",
      body: form.get("body") ?? "",
      paper: form.get("paper") ?? "cream"
    });

    if (!parsed.success) {
      setGuestError(parsed.error.issues[0].message);
      return;
    }

    const title = parsed.data.title || (kind === "note" ? "A little note" : "A letter");
    const item: GuestItem = {
      type: kind,
      title,
      payload: { body: parsed.data.body, paper: parsed.data.paper }
    };

    setGuestError("");
    setGuest({
      title,
      payload: { v: 1, title, items: [item] },
      blocks: [guestItemToBlock(item)]
    });
  }

  const formProps = signedIn
    ? { action: formAction }
    : { onSubmit: onGuestSubmit, noValidate: false };
  const error = signedIn ? state.error : guestError;

  return (
    <>
      <form {...formProps} className="studio-panel">
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
          <label htmlFor="paper">Paper</label>
          <select
            id="paper"
            name="paper"
            value={paper}
            onChange={(e) => setPaper(e.target.value as typeof paper)}
          >
            <option value="cream">Warm cream</option>
            <option value="blue">Powder blue</option>
            <option value="plum">Deep plum</option>
          </select>
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
          <div className={`paper-preview paper-${paper}`}>
            {body ? body : <span className="paper-placeholder">Your words appear here ♡</span>}
          </div>
        </div>
      )}
    </>
  );
}
