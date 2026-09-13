"use client";

import { useActionState, useState } from "react";
import { saveNote, saveLetter, type CreateState } from "@/app/create/actions";
import { PAPER_THEMES } from "@/lib/validation";
import { AiAssist } from "@/components/creators/AiAssist";

const initial: CreateState = {};

export function PaperCreator({ kind }: { kind: "note" | "letter" }) {
  const action = kind === "note" ? saveNote : saveLetter;
  const [state, formAction, pending] = useActionState(action, initial);

  const [body, setBody] = useState("");
  const [paper, setPaper] = useState<(typeof PAPER_THEMES)[number]>("cream");

  return (
    <>
      <form action={formAction} className="studio-panel">
        <div className="field">
          <label htmlFor="title">Title (optional)</label>
          <input id="title" name="title" placeholder={kind === "note" ? "A little note" : "A letter"} />
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
          <AiAssist kind={kind} onResult={(text) => setBody(text)} />
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

        {state.error ? (
          <p className="form-error" role="alert">
            {state.error}
          </p>
        ) : null}

        <div className="row-actions" style={{ marginTop: 16 }}>
          <button type="submit" className="button button-plum" disabled={pending}>
            {pending ? "Saving…" : "Save this"}
          </button>
        </div>
      </form>

      <div className="studio-panel">
        <p className="eyebrow">Preview</p>
        <div className={`paper-preview paper-${paper}`}>
          {body ? body : <span className="paper-placeholder">Your words appear here ♡</span>}
        </div>
      </div>
    </>
  );
}
