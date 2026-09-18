"use client";

import { useActionState, useState } from "react";
import { saveSong, type CreateState } from "@/app/create/actions";
import { songSchema } from "@/lib/validation";
import { GuestResult } from "@/components/guest/GuestResult";
import { guestItemToBlock, type KeepsakeBlock } from "@/components/guest/keepsake";
import type { GuestItem, GuestPayload } from "@/lib/guest-share";

const initial: CreateState = {};

interface GuestDone {
  title: string;
  payload: GuestPayload;
  blocks: KeepsakeBlock[];
}

export function SongCreator({ signedIn }: { signedIn: boolean }) {
  const [state, formAction, pending] = useActionState(saveSong, initial);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [guest, setGuest] = useState<GuestDone | null>(null);
  const [guestError, setGuestError] = useState("");

  let provider = "";
  try {
    if (url) provider = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    provider = "";
  }

  function onGuestSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = songSchema.safeParse({
      title: form.get("title") ?? "",
      url: form.get("url") ?? "",
      note: form.get("note") ?? ""
    });

    if (!parsed.success) {
      setGuestError(parsed.error.issues[0].message);
      return;
    }

    const title = parsed.data.title || "A song for you";
    const item: GuestItem = {
      type: "song",
      title,
      payload: {
        url: parsed.data.url,
        note: parsed.data.note,
        provider: new URL(parsed.data.url).hostname.replace(/^www\./, "")
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

  return (
    <>
      <form {...formProps} className="studio-panel">
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
          <div className="song-preview">
            <div className="song-art">♫</div>
            <div className="song-meta">
              <strong>{provider || "Your song"}</strong>
              <p>{note || "This song made me think of you."}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
