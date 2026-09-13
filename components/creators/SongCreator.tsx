"use client";

import { useActionState, useState } from "react";
import { saveSong, type CreateState } from "@/app/create/actions";

const initial: CreateState = {};

export function SongCreator() {
  const [state, formAction, pending] = useActionState(saveSong, initial);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");

  let provider = "";
  try {
    if (url) provider = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    provider = "";
  }

  return (
    <>
      <form action={formAction} className="studio-panel">
        <div className="field">
          <label htmlFor="title">Title (optional)</label>
          <input id="title" name="title" placeholder="A song for you" />
        </div>
        <div className="field">
          <label htmlFor="url">Song link</label>
          <input
            id="url"
            name="url"
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a Spotify / Apple Music / YouTube link"
          />
          <small style={{ color: "var(--mauve)" }}>
            We link to the song — we never re-host music.
          </small>
        </div>
        <div className="field">
          <label htmlFor="note">Why this song? (optional)</label>
          <textarea
            id="note"
            name="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="This song made me think of you…"
          />
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
        <div className="song-preview">
          <div className="song-art">♫</div>
          <div className="song-meta">
            <strong>{provider || "Your song"}</strong>
            <p>{note || "This song made me think of you."}</p>
          </div>
        </div>
      </div>
    </>
  );
}
