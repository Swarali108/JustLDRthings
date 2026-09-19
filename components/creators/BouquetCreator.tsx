"use client";

import { useActionState, useState } from "react";
import { saveBouquet, type CreateState } from "@/app/create/actions";
import { bouquetSchema } from "@/lib/validation";
import {
  FLOWERS,
  GREENERY,
  WRAPS,
  RIBBONS,
  MAX_STEMS,
  MAX_PER_FLOWER,
  MAX_GREENERY,
  MAX_PER_LEAF,
  countOf,
  addOne,
  removeOne,
  arrangementMeanings
} from "@/lib/flowers";
import { DEFAULT_STYLE, styleClasses, tiltStyle, type ItemStyle } from "@/lib/style";
import { StylePanel } from "@/components/creators/StylePanel";
import { Stepper } from "@/components/creators/Stepper";
import { GuestResult } from "@/components/guest/GuestResult";
import { guestItemToBlock, type KeepsakeBlock } from "@/components/guest/keepsake";
import { BouquetView } from "@/components/scrapbook/BouquetView";
import { FlowerArt, LeafArt } from "@/components/scrapbook/FlowerArt";
import type { GuestItem, GuestPayload } from "@/lib/guest-share";

const initial: CreateState = {};

interface GuestDone {
  title: string;
  payload: GuestPayload;
  blocks: KeepsakeBlock[];
}

export function BouquetCreator({ signedIn }: { signedIn: boolean }) {
  const [state, formAction, pending] = useActionState(saveBouquet, initial);

  // Stored as repeated ids rather than a count map: the renderer already walks a
  // list, and repeated short ids compress well in a share link.
  const [stems, setStems] = useState<string[]>([]);
  const [greens, setGreens] = useState<string[]>([]);
  const [wrap, setWrap] = useState("peach");
  const [ribbon, setRibbon] = useState("peach");
  const [note, setNote] = useState("");
  const [style, setStyle] = useState<ItemStyle>(DEFAULT_STYLE);
  const [guest, setGuest] = useState<GuestDone | null>(null);
  const [error, setError] = useState("");

  function build(form: FormData) {
    return bouquetSchema.safeParse({
      title: form.get("title") ?? "",
      stems,
      greenery: greens,
      wrap,
      ribbon,
      note: form.get("note") ?? "",
      style
    });
  }

  function onGuestSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = build(new FormData(event.currentTarget));
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    const title = parsed.data.title || "A bouquet for you";
    const item: GuestItem = {
      type: "bouquet",
      title,
      payload: {
        stems: parsed.data.stems,
        greenery: parsed.data.greenery,
        wrap: parsed.data.wrap,
        ribbon: parsed.data.ribbon,
        note: parsed.data.note,
        style
      }
    };

    setError("");
    setGuest({
      title,
      payload: { v: 1, title, items: [item] },
      blocks: [guestItemToBlock(item)]
    });
  }

  const formProps = signedIn ? { action: formAction } : { onSubmit: onGuestSubmit };
  const shownError = signedIn ? state.error : error;
  const meanings = arrangementMeanings(stems, greens);

  return (
    <>
      <form {...formProps} className="studio-panel">
        <div className="field">
          <label htmlFor="title">Title (optional)</label>
          <input id="title" name="title" placeholder="A bouquet for you" />
        </div>

        <input type="hidden" name="stems" value={stems.join(",")} />
        <input type="hidden" name="greenery" value={greens.join(",")} />
        <input type="hidden" name="wrap" value={wrap} />
        <input type="hidden" name="ribbon" value={ribbon} />
        <input type="hidden" name="style" value={JSON.stringify(style)} />

        <div className="field">
          <label>
            Flowers{" "}
            <span className="sty-muted" style={{ fontWeight: 400 }}>
              ({stems.length}/{MAX_STEMS})
            </span>
          </label>
          <div className="stepper-grid">
            {FLOWERS.map((flower) => (
              <Stepper
                key={flower.id}
                label={flower.label}
                meaning={flower.meaning}
                count={countOf(stems, flower.id)}
                perKindMax={MAX_PER_FLOWER}
                atTotal={stems.length >= MAX_STEMS}
                onAdd={() => setStems(addOne(stems, flower.id, MAX_PER_FLOWER, MAX_STEMS))}
                onRemove={() => setStems(removeOne(stems, flower.id))}
              >
                <FlowerArt flower={flower} size={52} />
              </Stepper>
            ))}
          </div>
          {stems.length ? (
            <button
              type="button"
              className="button button-light"
              style={{ marginTop: 10 }}
              onClick={() => setStems([])}
            >
              Clear flowers
            </button>
          ) : null}
        </div>

        <div className="field">
          <label>
            Filler leaves{" "}
            <span className="sty-muted" style={{ fontWeight: 400 }}>
              ({greens.length}/{MAX_GREENERY})
            </span>
          </label>
          <div className="stepper-grid">
            {GREENERY.map((leaf) => (
              <Stepper
                key={leaf.id}
                label={leaf.label}
                meaning={leaf.meaning}
                count={countOf(greens, leaf.id)}
                perKindMax={MAX_PER_LEAF}
                atTotal={greens.length >= MAX_GREENERY}
                onAdd={() => setGreens(addOne(greens, leaf.id, MAX_PER_LEAF, MAX_GREENERY))}
                onRemove={() => setGreens(removeOne(greens, leaf.id))}
              >
                <LeafArt leaf={leaf} size={52} />
              </Stepper>
            ))}
          </div>
          {greens.length ? (
            <button
              type="button"
              className="button button-light"
              style={{ marginTop: 10 }}
              onClick={() => setGreens([])}
            >
              Clear leaves
            </button>
          ) : null}
        </div>

        <div className="field">
          <label>Wrapping paper</label>
          <div className="style-row">
            {WRAPS.map((paper) => (
              <button
                key={paper.id}
                type="button"
                className="style-chip wrap-chip"
                aria-pressed={wrap === paper.id}
                onClick={() => setWrap(paper.id)}
              >
                <span className="wrap-swatch" style={{ background: paper.front }} />
                {paper.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Ribbon</label>
          <div className="style-row">
            {RIBBONS.map((tie) => (
              <button
                key={tie.id}
                type="button"
                className="style-chip wrap-chip"
                aria-pressed={ribbon === tie.id}
                onClick={() => setRibbon(tie.id)}
              >
                {tie.id !== "none" ? (
                  <span className="wrap-swatch" style={{ background: tie.color }} />
                ) : null}
                {tie.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="note">A line to go with it (optional)</label>
          <textarea
            id="note"
            name="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Picked these because they're you…"
          />
        </div>

        <div className="field">
          <label>Dress it up</label>
          <StylePanel value={style} onChange={setStyle} />
        </div>

        {shownError ? (
          <p className="form-error" role="alert">
            {shownError}
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
          <div className={styleClasses(style)}>
            <div className="styled-block" style={tiltStyle(style)}>
              <BouquetView
                stems={stems}
                greenery={greens}
                wrap={wrap}
                ribbon={ribbon}
                note={note}
                meanings={meanings}
                stickers={style.stickers}
              />
              {stems.length === 0 && greens.length === 0 ? (
                <span className="paper-placeholder">Your bouquet comes together here ♡</span>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
