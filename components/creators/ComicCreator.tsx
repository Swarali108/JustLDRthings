"use client";

import { useActionState, useState } from "react";
import { saveComic, saveAvatars, type CreateState } from "@/app/create/actions";
import {
  comicSchema,
  POSES,
  EXPRESSIONS,
  BACKGROUNDS,
  PANEL_COUNTS,
  POSE_LABELS,
  EXPRESSION_LABELS,
  BACKGROUND_LABELS,
  MAX_DIALOGUE_CHARS,
  type Comic,
  type PanelCount,
  type Pose,
  type Expression,
  type Background
} from "@/lib/comic";
import { DEFAULT_PAIR, type AvatarPair } from "@/lib/avatar";
import { DEFAULT_STYLE, styleClasses, tiltStyle, type ItemStyle } from "@/lib/style";
import { StylePanel } from "@/components/creators/StylePanel";
import { AvatarBuilder } from "@/components/creators/AvatarBuilder";
import { ComicView } from "@/components/comic/ComicView";
import { CharacterArt } from "@/components/comic/CharacterArt";
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
 * Make a comic: build the two characters, describe a memory, pick a length.
 *
 * Everything the model decided stays editable afterwards — dialogue, poses,
 * expressions, backgrounds, panel order. A model wrote the script; the person
 * sending it should be able to change any line they would not say.
 *
 * `savedAvatars` comes from the database for signed-in users, so the two faces
 * are built once and reused. Guests start from the defaults and keep them only
 * for the session, which is the same no-storage rule as everywhere else.
 */
export function ComicCreator({
  signedIn,
  savedAvatars
}: {
  signedIn: boolean;
  savedAvatars: AvatarPair | null;
}) {
  const [state, formAction, pending] = useActionState(saveComic, initial);

  const [avatars, setAvatars] = useState<AvatarPair>(savedAvatars ?? DEFAULT_PAIR);
  const [avatarsOpen, setAvatarsOpen] = useState(!savedAvatars);
  const [avatarNote, setAvatarNote] = useState("");

  const [memory, setMemory] = useState("");
  const [panels, setPanels] = useState<PanelCount>(4);
  const [comic, setComic] = useState<Comic | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [style, setStyle] = useState<ItemStyle>(DEFAULT_STYLE);
  const [guest, setGuest] = useState<GuestDone | null>(null);

  async function rememberAvatars() {
    if (!signedIn) return;
    setAvatarNote("");
    const res = await saveAvatars(avatars);
    setAvatarNote(res.error ? res.error : "Saved — these two are yours now. ♡");
  }

  async function generate() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/ai/comic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memory,
          panels,
          names: { a: avatars.a.name, b: avatars.b.name }
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "The comic maker had trouble. Try again.");
        return;
      }

      const parsed = comicSchema.safeParse({ ...data.comic, avatars, overlay: null });
      if (!parsed.success) {
        setError("That comic came back malformed. Try again.");
        return;
      }
      setComic(parsed.data);
    } catch {
      setError("Couldn't reach the comic maker. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  // ---- panel editing --------------------------------------------------------

  function updatePanel(i: number, patch: Partial<Comic["panels"][number]>) {
    if (!comic) return;
    const next = [...comic.panels];
    next[i] = { ...next[i], ...patch };
    setComic({ ...comic, panels: next });
  }

  function updateCharacter(pi: number, ci: number, patch: { pose?: Pose; expression?: Expression }) {
    if (!comic) return;
    const panel = comic.panels[pi];
    const characters = [...panel.characters];
    characters[ci] = { ...characters[ci], ...patch };
    updatePanel(pi, { characters });
  }

  function updateLine(pi: number, li: number, text: string) {
    if (!comic) return;
    const dialogue = [...comic.panels[pi].dialogue];
    dialogue[li] = { ...dialogue[li], text: text.slice(0, MAX_DIALOGUE_CHARS) };
    updatePanel(pi, { dialogue });
  }

  function movePanel(i: number, by: -1 | 1) {
    if (!comic) return;
    const to = i + by;
    if (to < 0 || to >= comic.panels.length) return;
    const next = [...comic.panels];
    [next[i], next[to]] = [next[to], next[i]];
    setComic({ ...comic, panels: next });
  }

  function onGuestSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!comic) {
      setError("Make a comic first.");
      return;
    }
    const title = comic.title || "A little comic";
    const item: GuestItem = { type: "comic", title, payload: { comic, style } };
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
        <input type="hidden" name="comic" value={JSON.stringify(comic ?? null)} />

        <div className="field">
          <div className="title-row">
            <label>The two of you</label>
            <button
              type="button"
              className="button button-light"
              onClick={() => setAvatarsOpen((o) => !o)}
            >
              {avatarsOpen ? "Done" : "Change"}
            </button>
          </div>

          {avatarsOpen ? (
            <>
              <AvatarBuilder
                label="You"
                value={avatars.a}
                onChange={(a) => setAvatars({ ...avatars, a })}
              />
              <AvatarBuilder
                label="Them"
                value={avatars.b}
                onChange={(b) => setAvatars({ ...avatars, b })}
              />
              {signedIn ? (
                <div className="row-actions" style={{ marginTop: 10 }}>
                  <button type="button" className="button button-light" onClick={rememberAvatars}>
                    Remember these two
                  </button>
                  {avatarNote ? <small style={{ color: "var(--mauve)" }}>{avatarNote}</small> : null}
                </div>
              ) : (
                <p className="form-notice">
                  These two are yours for this visit. Make an account and
                  they&apos;ll be waiting next time.
                </p>
              )}
            </>
          ) : (
            <div className="avatar-row">
              <AvatarChip avatar={avatars.a} caption={avatars.a.name || "You"} />
              <AvatarChip avatar={avatars.b} caption={avatars.b.name || "Them"} />
            </div>
          )}
        </div>

        <div className="field">
          <label htmlFor="memory">A memory, or an inside joke</label>
          <textarea
            id="memory"
            name="memory"
            required
            value={memory}
            onChange={(e) => setMemory(e.target.value)}
            style={{ minHeight: 130 }}
            placeholder="The time her train was delayed four hours and we stayed on video call the whole night…"
          />
          <small style={{ color: "var(--mauve)" }}>{memory.trim().length}/1200</small>
        </div>

        <div className="field">
          <label>How many panels</label>
          <div className="style-row">
            {PANEL_COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                className="style-chip"
                aria-pressed={panels === n}
                onClick={() => setPanels(n)}
              >
                {n} panels
              </button>
            ))}
          </div>
        </div>

        <div className="row-actions">
          <button
            type="button"
            className="button button-plum"
            onClick={generate}
            disabled={busy || memory.trim().length < 30}
          >
            {busy ? "Drawing…" : comic ? "Draw another" : "Draw the comic ♡"}
          </button>
        </div>

        {comic ? (
          <>
            <div className="field">
              <label>Edit the panels</label>
              <p style={{ color: "var(--mauve)", fontSize: "0.85rem", margin: "2px 0 0" }}>
                A model wrote this. Change anything that isn&apos;t how it went.
              </p>

              {comic.panels.map((panel, pi) => (
                <div key={pi} className="panel-editor">
                  <div className="title-row">
                    <strong>Panel {pi + 1}</strong>
                    <span className="row-actions">
                      <button type="button" className="icon-button" onClick={() => movePanel(pi, -1)} disabled={pi === 0} aria-label="Move panel up">↑</button>
                      <button type="button" className="icon-button" onClick={() => movePanel(pi, 1)} disabled={pi === comic.panels.length - 1} aria-label="Move panel down">↓</button>
                    </span>
                  </div>

                  <label className="mini-label">Where</label>
                  <select
                    value={panel.background}
                    onChange={(e) => updatePanel(pi, { background: e.target.value as Background })}
                  >
                    {BACKGROUNDS.map((b) => (
                      <option key={b} value={b}>{BACKGROUND_LABELS[b]}</option>
                    ))}
                  </select>

                  {panel.characters.map((c, ci) => (
                    <div key={ci} className="char-editor">
                      <span className="mini-label">
                        {c.who === "A" ? avatars.a.name || "You" : avatars.b.name || "Them"}
                      </span>
                      <select
                        value={c.pose}
                        onChange={(e) => updateCharacter(pi, ci, { pose: e.target.value as Pose })}
                        aria-label="Pose"
                      >
                        {POSES.map((p) => (
                          <option key={p} value={p}>{POSE_LABELS[p]}</option>
                        ))}
                      </select>
                      <select
                        value={c.expression}
                        onChange={(e) => updateCharacter(pi, ci, { expression: e.target.value as Expression })}
                        aria-label="Expression"
                      >
                        {EXPRESSIONS.map((x) => (
                          <option key={x} value={x}>{EXPRESSION_LABELS[x]}</option>
                        ))}
                      </select>
                    </div>
                  ))}

                  {panel.dialogue.map((line, li) => (
                    <div key={li} className="line-editor">
                      <span className="mini-label">
                        {line.speaker === "narrator"
                          ? "Caption voice"
                          : line.speaker === "A"
                            ? avatars.a.name || "You"
                            : avatars.b.name || "Them"}
                      </span>
                      <input
                        value={line.text}
                        maxLength={MAX_DIALOGUE_CHARS}
                        onChange={(e) => updateLine(pi, li, e.target.value)}
                        aria-label="Dialogue"
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="field">
              <label>Dress it up</label>
              <StylePanel value={style} onChange={setStyle} />
            </div>
          </>
        ) : null}

        {shownError ? (
          <p className="form-error" role="alert">
            {shownError}
          </p>
        ) : null}

        {comic ? (
          <div className="row-actions" style={{ marginTop: 16 }}>
            <button type="submit" className="button button-plum" disabled={pending}>
              {signedIn ? (pending ? "Saving…" : "Save this") : "Finish this ♡"}
            </button>
            <button type="button" className="button button-light" onClick={() => setComic(null)}>
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
              {comic ? (
                <ComicView comic={comic} />
              ) : (
                <span className="paper-placeholder">Your comic appears here ♡</span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** The collapsed row: just the head and shoulders, cropped by the viewBox. */
function AvatarChip({ avatar, caption }: { avatar: AvatarPair["a"]; caption: string }) {
  return (
    <span className="avatar-chip">
      <svg viewBox="-28 -94 56 46" aria-hidden>
        <CharacterArt avatar={avatar} pose="standing" expression="happy" />
      </svg>
      <small>{caption}</small>
    </span>
  );
}
