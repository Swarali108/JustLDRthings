"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createMediaDraft, attachMedia, discardDraft } from "@/app/create/actions";
import { LIMITS, getUserId, uploadToUserMedia } from "@/components/creators/upload";
import { GuestResult } from "@/components/guest/GuestResult";
import {
  readAsDataUrl,
  KEEPSAKE_MEDIA_LIMIT,
  type KeepsakeBlock
} from "@/components/guest/keepsake";

export function VoiceCreator({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filename, setFilename] = useState("voice-note.webm");
  const [guest, setGuest] = useState<{ title: string; blocks: KeepsakeBlock[] } | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  function setClip(b: Blob, name: string) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setBlob(b);
    setFilename(name);
    setPreviewUrl(URL.createObjectURL(b));
  }

  async function startRecording() {
    setError("");
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Recording isn't supported here — upload an audio file instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        const b = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        setClip(b, "voice-note.webm");
        stream.getTracks().forEach((t) => t.stop());
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setError("We couldn't reach your microphone. Check permissions or upload a file.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  function onUploadPick(f: File | null) {
    setError("");
    if (!f) return;
    if (!f.type.startsWith("audio/")) {
      setError("That isn't an audio file. Try an .mp3, .m4a or .webm.");
      return;
    }
    setClip(f, f.name);
  }

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!blob) {
      setError("Record or upload a voice note first.");
      return;
    }
    if (blob.size > LIMITS.audio) {
      setError("That clip is too long. Keep it under 20 MB.");
      return;
    }

    const form = new FormData(e.currentTarget);
    const title = String(form.get("title") || "");
    const transcript = String(form.get("transcript") || "");

    // Guest path: audio cannot travel in a URL, so the clip is bundled into a
    // keepsake file instead of becoming a link.
    if (!signedIn) {
      setBusy(true);
      const dataUrl = await readAsDataUrl(blob);
      setBusy(false);
      setGuest({
        title: title || "A voice note",
        blocks: [
          {
            kind: "voice",
            title: title || "A voice note",
            transcript,
            mediaKind: "audio",
            mediaDataUrl: dataUrl ?? undefined
          }
        ]
      });
      return;
    }

    setBusy(true);
    const uid = await getUserId();
    if (!uid) {
      setBusy(false);
      router.push("/login");
      return;
    }

    const draft = await createMediaDraft("voice", title, { transcript });
    if (!draft.ok || !draft.id) {
      setBusy(false);
      setError(draft.error || "Could not start the upload.");
      return;
    }

    const up = await uploadToUserMedia(blob, uid, draft.id, filename);
    if (up.error || !up.path) {
      await discardDraft(draft.id);
      setBusy(false);
      setError(up.error || "That clip couldn't be uploaded. Try again.");
      return;
    }

    const attached = await attachMedia(
      draft.id,
      up.path,
      "audio",
      blob.type || "audio/webm",
      blob.size
    );
    if (!attached.ok) {
      setBusy(false);
      setError(attached.error || "Upload saved but couldn't be recorded.");
      return;
    }

    router.push("/dashboard?created=voice");
  }

  return (
    <>
      <form onSubmit={onSave} className="studio-panel">
        <div className="field">
          <label htmlFor="title">Title (optional)</label>
          <input id="title" name="title" placeholder="A voice note" />
        </div>

        <div className="field">
          <label>Record</label>
          <div className="row-actions">
            {!recording ? (
              <button type="button" className="button button-plum" onClick={startRecording}>
                ● Start recording
              </button>
            ) : (
              <button type="button" className="button button-light" onClick={stopRecording}>
                ■ Stop
              </button>
            )}
          </div>
        </div>

        <div className="field">
          <label htmlFor="audio">…or upload audio</label>
          <input
            id="audio"
            type="file"
            accept="audio/*"
            onChange={(e) => onUploadPick(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="field">
          <label htmlFor="transcript">Text version (optional, for accessibility)</label>
          <textarea id="transcript" name="transcript" placeholder="What you said…" />
        </div>

        {!signedIn ? (
          <p className="form-notice">
            Voice notes can&apos;t travel inside a link, so this one saves to your
            laptop instead.{" "}
            {blob && blob.size > KEEPSAKE_MEDIA_LIMIT
              ? "This clip is also too long to tuck into the keepsake — sign in to share it properly."
              : "Sign in if you'd rather send a link."}
          </p>
        ) : null}

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="row-actions" style={{ marginTop: 16 }}>
          <button type="submit" className="button button-plum" disabled={busy}>
            {signedIn ? (busy ? "Uploading…" : "Save this") : busy ? "Wrapping…" : "Finish this ♡"}
          </button>
        </div>
      </form>

      {guest ? (
        <GuestResult
          title={guest.title}
          payload={null}
          blocks={guest.blocks}
          onEdit={() => setGuest(null)}
          unshareableReason="Voice notes are too big for a link. Save it to your laptop below, or sign in to send one."
        />
      ) : (
        <div className="studio-panel">
          <p className="eyebrow">Preview</p>
          <div className="voice-preview">
            {previewUrl ? (
              <audio src={previewUrl} controls />
            ) : (
              <span className="paper-placeholder">
                {recording ? "Recording… ♡" : "Your voice note plays here ♡"}
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
