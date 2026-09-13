"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMediaDraft, attachMedia, discardDraft } from "@/app/create/actions";
import {
  LIMITS,
  mediaTypeForMime,
  getUserId,
  uploadToUserMedia
} from "@/components/creators/upload";

export function MediaCreator() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function onPick(f: File | null) {
    setError("");
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f ? URL.createObjectURL(f) : "");
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!file) {
      setError("Pick a photo or video first.");
      return;
    }
    const mt = mediaTypeForMime(file.type);
    if (mt !== "image" && mt !== "video") {
      setError("That file type isn't supported. Try a photo or a video.");
      return;
    }
    if (file.size > LIMITS[mt]) {
      setError(
        mt === "image"
          ? "That image is too large. Try one under 10 MB."
          : "That video is too large. Try one under 60 MB."
      );
      return;
    }

    const form = new FormData(e.currentTarget);
    const title = String(form.get("title") || "");
    const caption = String(form.get("caption") || "");

    setBusy(true);
    const uid = await getUserId();
    if (!uid) {
      setBusy(false);
      router.push("/login");
      return;
    }

    const draft = await createMediaDraft("media", title, { caption });
    if (!draft.ok || !draft.id) {
      setBusy(false);
      setError(draft.error || "Could not start the upload.");
      return;
    }

    const up = await uploadToUserMedia(file, uid, draft.id, file.name);
    if (up.error || !up.path) {
      await discardDraft(draft.id);
      setBusy(false);
      setError(up.error || "That file couldn't be uploaded. Try again.");
      return;
    }

    const attached = await attachMedia(draft.id, up.path, mt, file.type, file.size);
    if (!attached.ok) {
      setBusy(false);
      setError(attached.error || "Upload saved but couldn't be recorded.");
      return;
    }

    router.push("/dashboard?created=media");
  }

  const isVideo = file ? mediaTypeForMime(file.type) === "video" : false;

  return (
    <>
      <form onSubmit={onSubmit} className="studio-panel">
        <div className="field">
          <label htmlFor="title">Title (optional)</label>
          <input id="title" name="title" placeholder="A little moment" />
        </div>
        <div className="field">
          <label htmlFor="file">Photo or video</label>
          <input
            id="file"
            name="file"
            type="file"
            accept="image/*,video/*"
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          />
          <small style={{ color: "var(--mauve)" }}>Images up to 10 MB · videos up to 60 MB.</small>
        </div>
        <div className="field">
          <label htmlFor="caption">Caption (optional)</label>
          <input id="caption" name="caption" placeholder="Wish you were here…" />
        </div>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="row-actions" style={{ marginTop: 16 }}>
          <button type="submit" className="button button-plum" disabled={busy}>
            {busy ? "Uploading…" : "Save this"}
          </button>
        </div>
      </form>

      <div className="studio-panel">
        <p className="eyebrow">Preview</p>
        <div className="media-frame">
          {previewUrl ? (
            isVideo ? (
              <video src={previewUrl} controls />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Selected media preview" />
            )
          ) : (
            <span className="paper-placeholder">Your photo or video shows here ♡</span>
          )}
        </div>
      </div>
    </>
  );
}
