"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMediaDraft, attachMedia, discardDraft } from "@/app/create/actions";
import { LIMITS, getUserId, uploadToUserMedia } from "@/components/creators/upload";
import { DEFAULT_STYLE, styleClasses, tiltStyle, type ItemStyle } from "@/lib/style";
import { StylePanel } from "@/components/creators/StylePanel";
import { GuestResult } from "@/components/guest/GuestResult";
import {
  readAsDataUrl,
  KEEPSAKE_MEDIA_LIMIT,
  type KeepsakeBlock
} from "@/components/guest/keepsake";

export const MAX_PHOTOS = 6;

interface Picked {
  file: File;
  url: string;
}

export function CollageCreator({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [style, setStyle] = useState<ItemStyle>({ ...DEFAULT_STYLE, theme: "polaroid" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [guest, setGuest] = useState<{ title: string; blocks: KeepsakeBlock[] } | null>(null);

  function onPick(list: FileList | null) {
    setError("");
    if (!list) return;

    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      setError(`A collage holds up to ${MAX_PHOTOS} photos.`);
      return;
    }

    const incoming = Array.from(list).slice(0, room);
    const bad = incoming.find((f) => !f.type.startsWith("image/"));
    if (bad) {
      setError("Collages are photos only — pick images.");
      return;
    }
    const tooBig = incoming.find((f) => f.size > LIMITS.image);
    if (tooBig) {
      setError("One of those images is over 10 MB. Try a smaller one.");
      return;
    }

    setPhotos([...photos, ...incoming.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  }

  function removeAt(index: number) {
    const next = [...photos];
    const [gone] = next.splice(index, 1);
    if (gone) URL.revokeObjectURL(gone.url);
    setPhotos(next);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (photos.length === 0) {
      setError("Add at least one photo.");
      return;
    }

    const form = new FormData(e.currentTarget);
    const title = String(form.get("title") || "");
    const caption = String(form.get("caption") || "");

    // Guest path: photos can't travel in a URL, so this becomes a keepsake file
    // with every image embedded. Same limit and same reasoning as a single photo.
    if (!signedIn) {
      setBusy(true);
      setProgress("Wrapping your photos…");
      const urls: string[] = [];
      for (const photo of photos) {
        const dataUrl = await readAsDataUrl(photo.file);
        if (dataUrl) urls.push(dataUrl);
      }
      setBusy(false);
      setProgress("");

      if (urls.length === 0) {
        setError(
          `Those photos are too large to tuck into a file (over ${Math.round(
            KEEPSAKE_MEDIA_LIMIT / (1024 * 1024)
          )} MB each). Sign in to share them properly.`
        );
        return;
      }

      setGuest({
        title: title || "A little collection",
        blocks: [
          {
            kind: "collage",
            title: title || "A little collection",
            caption,
            collageDataUrls: urls,
            style
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

    const draft = await createMediaDraft("collage", title, { caption, style });
    if (!draft.ok || !draft.id) {
      setBusy(false);
      setError(draft.error || "Could not start the upload.");
      return;
    }

    // Upload each photo in turn, attaching as we go. If one fails partway we
    // discard the whole draft rather than leaving a half-built collage.
    for (let i = 0; i < photos.length; i++) {
      setProgress(`Uploading ${i + 1} of ${photos.length}…`);
      const photo = photos[i];
      const up = await uploadToUserMedia(photo.file, uid, draft.id, `${i}-${photo.file.name}`);
      if (up.error || !up.path) {
        await discardDraft(draft.id);
        setBusy(false);
        setProgress("");
        setError(up.error || "That photo couldn't be uploaded. Try again.");
        return;
      }
      const attached = await attachMedia(
        draft.id,
        up.path,
        "image",
        photo.file.type,
        photo.file.size
      );
      if (!attached.ok) {
        await discardDraft(draft.id);
        setBusy(false);
        setProgress("");
        setError(attached.error || "Upload saved but couldn't be recorded.");
        return;
      }
    }

    router.push("/dashboard?created=collage");
  }

  return (
    <>
      <form onSubmit={onSubmit} className="studio-panel">
        <div className="field">
          <label htmlFor="title">Title (optional)</label>
          <input id="title" name="title" placeholder="A little collection" />
        </div>

        <div className="field">
          <label htmlFor="photos">
            Photos{" "}
            <span className="sty-muted" style={{ fontWeight: 400 }}>
              ({photos.length}/{MAX_PHOTOS})
            </span>
          </label>
          <input
            id="photos"
            type="file"
            accept="image/*"
            multiple
            disabled={photos.length >= MAX_PHOTOS}
            onChange={(e) => {
              onPick(e.target.files);
              e.target.value = "";
            }}
          />
          <small style={{ color: "var(--mauve)" }}>
            Up to {MAX_PHOTOS} photos, 10 MB each. They arrange themselves.
          </small>
        </div>

        <div className="field">
          <label htmlFor="caption">Caption (optional)</label>
          <input id="caption" name="caption" placeholder="the good days ♡" />
        </div>

        <div className="field">
          <label>Dress it up</label>
          <StylePanel value={style} onChange={setStyle} />
        </div>

        {!signedIn ? (
          <p className="form-notice">
            Photos can&apos;t travel inside a link, so a guest collage saves to your
            laptop as one file with every picture inside it. Sign in if you&apos;d
            rather send a link.
          </p>
        ) : null}

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="row-actions" style={{ marginTop: 16 }}>
          <button type="submit" className="button button-plum" disabled={busy}>
            {busy ? progress || "Working…" : signedIn ? "Save this" : "Finish this ♡"}
          </button>
        </div>
      </form>

      {guest ? (
        <GuestResult
          title={guest.title}
          payload={null}
          blocks={guest.blocks}
          onEdit={() => setGuest(null)}
          unshareableReason="Photos are too big for a link. Save the collage to your laptop below, or sign in to send one."
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
              {photos.length ? (
                <div className={`collage-grid count-${photos.length}`}>
                  {photos.map((photo, i) => (
                    <div key={photo.url} className="collage-cell">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt={`Photo ${i + 1}`} />
                      <button
                        type="button"
                        className="collage-remove"
                        aria-label={`Remove photo ${i + 1}`}
                        onClick={() => removeAt(i)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="paper-placeholder">Your photos arrange themselves here ♡</span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
