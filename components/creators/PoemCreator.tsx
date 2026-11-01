"use client";

import { useActionState, useState } from "react";
import { savePoem, type CreateState } from "@/app/create/actions";
import {
  poemSchema,
  detailsUsedIn,
  wholePoem,
  POEM_FORMS,
  FORM_LABELS,
  DETAIL_LABELS,
  MIN_DETAILS_USED,
  type Poem,
  type PoemForm
} from "@/lib/poem";
import { DEFAULT_STYLE, styleClasses, tiltStyle, type ItemStyle } from "@/lib/style";
import { StylePanel } from "@/components/creators/StylePanel";
import { PoemView } from "@/components/scrapbook/PoemView";
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
 * Write a paragraph, pick a form, get a poem built from their own details.
 *
 * The poem is a draft in component state until saved, so it can be edited or
 * thrown away. The body is editable on purpose: a model wrote it, and the
 * person sending it should be able to change a line they do not mean.
 */
export function PoemCreator({ signedIn }: { signedIn: boolean }) {
  const [state, formAction, pending] = useActionState(savePoem, initial);

  const [paragraph, setParagraph] = useState("");
  const [form, setForm] = useState<PoemForm>("rhyming");
  const [poem, setPoem] = useState<Poem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [style, setStyle] = useState<ItemStyle>({ ...DEFAULT_STYLE, font: "script" });
  const [guest, setGuest] = useState<GuestDone | null>(null);

  async function generate() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/ai/poem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paragraph, form })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "The poem maker had trouble. Try again.");
        return;
      }

      const parsed = poemSchema.safeParse(data.poem);
      if (!parsed.success) {
        setError("That poem came back malformed. Try again.");
        return;
      }
      setPoem(parsed.data);
    } catch {
      setError("Couldn't reach the poem maker. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function onGuestSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!poem) {
      setError("Make a poem first.");
      return;
    }
    const title = poem.title || "A poem for you";
    const item: GuestItem = { type: "poem", title, payload: { poem, style } };
    setGuest({
      title,
      payload: { v: 1, title, items: [item] },
      blocks: [guestItemToBlock(item)]
    });
  }

  const formProps = signedIn ? { action: formAction } : { onSubmit: onGuestSubmit };
  const shownError = signedIn ? state.error || error : error;
  const short = poem ? poem.used.length < MIN_DETAILS_USED : false;

  return (
    <>
      <form {...formProps} className="studio-panel">
        <input type="hidden" name="style" value={JSON.stringify(style)} />
        <input type="hidden" name="poem" value={JSON.stringify(poem ?? null)} />

        <div className="field">
          <label htmlFor="paragraph">Tell me about them</label>
          <p style={{ color: "var(--mauve)", fontSize: "0.85rem", margin: "2px 0 0" }}>
            Names, nicknames, where you met, a date that matters, an inside joke.
            The poem is built out of these, so the more real detail the better.
          </p>
          <textarea
            id="paragraph"
            name="paragraph"
            required
            value={paragraph}
            onChange={(e) => setParagraph(e.target.value)}
            style={{ minHeight: 160 }}
            placeholder="Her name is Meera, I call her bun. We met in Pune in July 2023, in the rain outside a bookshop…"
          />
          <small style={{ color: "var(--mauve)" }}>{paragraph.trim().length}/2000</small>
        </div>

        <div className="field">
          <label>Form</label>
          <div className="style-row">
            {POEM_FORMS.map((f) => (
              <button
                key={f}
                type="button"
                className="style-chip"
                aria-pressed={form === f}
                onClick={() => setForm(f)}
              >
                {FORM_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        <div className="row-actions">
          <button
            type="button"
            className="button button-plum"
            onClick={generate}
            disabled={busy || paragraph.trim().length < 40}
          >
            {busy ? "Writing…" : poem ? "Write another" : "Write the poem ♡"}
          </button>
        </div>

        {busy ? (
          <p className="form-notice">
            Reading it for the things only you two know, then writing. ♡
          </p>
        ) : null}

        {poem ? (
          <p className={short ? "form-notice" : "form-notice"}>
            <strong>
              {poem.used.length} of their {poem.found.length} details woven in
            </strong>
            {short
              ? " — fewer than hoped. Try adding another specific thing to your paragraph, or write it again."
              : "."}
          </p>
        ) : null}

        {poem ? (
          <>
            <div className="field">
              <label htmlFor="body">Edit it</label>
              <p style={{ color: "var(--mauve)", fontSize: "0.85rem", margin: "2px 0 0" }}>
                A model wrote this. Change any line that isn&apos;t how you&apos;d say it.
              </p>
              <textarea
                id="body"
                value={poem.body}
                onChange={(e) => {
                  // Re-count as they type: an edited poem must not keep
                  // claiming it used details the edit removed.
                  const body = e.target.value;
                  setPoem({
                    ...poem,
                    body,
                    used: detailsUsedIn(wholePoem(poem.title, body), poem.found)
                  });
                }}
                style={{ minHeight: 220, fontFamily: "Caveat, cursive", fontSize: "1.15rem" }}
              />
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

        {poem ? (
          <div className="row-actions" style={{ marginTop: 16 }}>
            <button type="submit" className="button button-plum" disabled={pending}>
              {signedIn ? (pending ? "Saving…" : "Save this") : "Finish this ♡"}
            </button>
            <button type="button" className="button button-light" onClick={() => setPoem(null)}>
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
              {poem ? (
                <PoemView poem={poem} />
              ) : (
                <span className="paper-placeholder">Your poem appears here ♡</span>
              )}
            </div>
          </div>

          {poem && poem.found.length > 0 ? (
            <div className="poem-detail-list">
              <p className="eyebrow" style={{ marginTop: 16 }}>
                What it found in your paragraph
              </p>
              <ul>
                {poem.found.map((d, i) => {
                  const used = poem.used.some((u) => u.value === d.value && u.kind === d.kind);
                  return (
                    <li key={`${d.kind}-${i}`} className={used ? "detail-used" : "detail-unused"}>
                      <span aria-hidden>{used ? "✓" : "○"}</span>{" "}
                      <em>{DETAIL_LABELS[d.kind]}</em> {d.value}
                      {!used ? <small> (not used)</small> : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
