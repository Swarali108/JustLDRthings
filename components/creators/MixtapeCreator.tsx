"use client";

import { useActionState, useState } from "react";
import { saveMixtape, type CreateState } from "@/app/create/actions";
import { mixtapeSchema, type Mixtape } from "@/lib/mixtape";
import { DEFAULT_STYLE, styleClasses, tiltStyle, type ItemStyle } from "@/lib/style";
import { StylePanel } from "@/components/creators/StylePanel";
import { MixtapeView } from "@/components/scrapbook/MixtapeView";
import { GuestResult } from "@/components/guest/GuestResult";
import { guestItemToBlock, type KeepsakeBlock } from "@/components/guest/keepsake";
import type { GuestItem, GuestPayload } from "@/lib/guest-share";

const initial: CreateState = {};

interface GuestDone {
  title: string;
  payload: GuestPayload;
  blocks: KeepsakeBlock[];
}

/**
 * Write a paragraph, get a mixtape.
 *
 * The result is a *draft* held in component state: nothing is written anywhere
 * until "Save this" (signed in) or "Finish this" (guest). That is what lets the
 * user drop a song they dislike, reorder the rest, or throw the whole thing
 * away and ask again — which matters when a model picked the songs.
 */
export function MixtapeCreator({ signedIn }: { signedIn: boolean }) {
  const [state, formAction, pending] = useActionState(saveMixtape, initial);

  const [paragraph, setParagraph] = useState("");
  const [mixtape, setMixtape] = useState<Mixtape | null>(null);
  const [stats, setStats] = useState<{ proposed: number; verified: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [style, setStyle] = useState<ItemStyle>({ ...DEFAULT_STYLE, theme: "midnight" });
  const [guest, setGuest] = useState<GuestDone | null>(null);

  async function generate() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/ai/mixtape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paragraph })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "The mixtape maker had trouble. Try again.");
        return;
      }

      const parsed = mixtapeSchema.safeParse(data.mixtape);
      if (!parsed.success) {
        setError("That mixtape came back malformed. Try again.");
        return;
      }

      setMixtape(parsed.data);
      setStats({ proposed: data.stats?.proposed ?? 0, verified: data.stats?.verified ?? 0 });
    } catch {
      setError("Couldn't reach the mixtape maker. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function onGuestSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mixtape) {
      setError("Make a mixtape first.");
      return;
    }

    const title = mixtape.title || "A mixtape for you";
    const item: GuestItem = {
      type: "mixtape",
      title,
      payload: { mixtape, style }
    };

    setGuest({
      title,
      payload: { v: 1, title, items: [item] },
      blocks: [guestItemToBlock(item)]
    });
  }

  const formProps = signedIn ? { action: formAction } : { onSubmit: onGuestSubmit };
  const shownError = signedIn ? state.error || error : error;

  return (
    <>
      <form {...formProps} className="studio-panel">
        <input type="hidden" name="style" value={JSON.stringify(style)} />
        <input type="hidden" name="mixtape" value={JSON.stringify(mixtape ?? null)} />

        <div className="field">
          <label htmlFor="paragraph">Tell me about them</label>
          <p style={{ color: "var(--mauve)", fontSize: "0.85rem", margin: "2px 0 0" }}>
            Memories, the mood you&apos;re after, languages they speak, artists
            they already love. The more specific, the better the tape.
          </p>
          <textarea
            id="paragraph"
            name="paragraph"
            required
            value={paragraph}
            onChange={(e) => setParagraph(e.target.value)}
            style={{ minHeight: 160 }}
            placeholder="She grew up on 90s Bollywood and Fleetwood Mac. We met in Pune during monsoon…"
          />
          <small style={{ color: "var(--mauve)" }}>{paragraph.trim().length}/2000</small>
        </div>

        <div className="row-actions">
          <button
            type="button"
            className="button button-plum"
            onClick={generate}
            disabled={busy || paragraph.trim().length < 40}
          >
            {busy ? "Finding songs…" : mixtape ? "Try again" : "Make the mixtape ♡"}
          </button>
        </div>

        {busy ? (
          <p className="form-notice">
            Looking every song up to be sure it&apos;s real — this takes a few
            seconds. ♡
          </p>
        ) : null}

        {stats ? (
          <p className="form-notice">
            <strong>
              {stats.verified} of {stats.proposed} songs verified
            </strong>
            {stats.proposed > stats.verified
              ? ` — ${stats.proposed - stats.verified} couldn't be confirmed as real, so they were left out.`
              : " — every one was confirmed as a real song."}
          </p>
        ) : null}

        {mixtape ? (
          <div className="field">
            <label>Dress it up</label>
            <StylePanel value={style} onChange={setStyle} />
          </div>
        ) : null}

        {shownError ? (
          <p className="form-error" role="alert">
            {shownError}
          </p>
        ) : null}

        {mixtape ? (
          <div className="row-actions" style={{ marginTop: 16 }}>
            <button
              type="submit"
              className="button button-plum"
              disabled={pending || mixtape.tracks.length === 0}
            >
              {signedIn ? (pending ? "Saving…" : "Save this") : "Finish this ♡"}
            </button>
            <button type="button" className="button button-light" onClick={() => { setMixtape(null); setStats(null); }}>
              Start over
            </button>
          </div>
        ) : null}
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
              {mixtape ? (
                <MixtapeView mixtape={mixtape} editable onChange={setMixtape} />
              ) : (
                <span className="paper-placeholder">Your mixtape appears here ♡</span>
              )}
            </div>
          </div>
          {mixtape ? (
            <p style={{ color: "var(--mauve)", fontSize: "0.82rem", marginTop: 12 }}>
              Drop a song, reorder them, or start over — nothing is saved until
              you finish.
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}
