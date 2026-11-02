import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ComicPanel } from "@/components/comic/ComicPanel";
import { CharacterArt } from "@/components/comic/CharacterArt";
import { BACKGROUNDS, POSES, EXPRESSIONS, MAX_DIALOGUE_CHARS, type Panel } from "@/lib/comic";
import { DEFAULT_PAIR, HAIR_STYLES, ACCESSORIES, SKIN_TONES } from "@/lib/avatar";

/**
 * These render the real components. They exist because the art is the one part
 * a schema cannot check: a malformed path or a bad fill type-checks fine and
 * only fails when someone looks at it.
 */

const panel = (over: Partial<Panel> = {}): Panel => ({
  background: "cafe",
  characters: [{ who: "A", pose: "standing", expression: "happy", position: "left" }],
  dialogue: [{ speaker: "A", text: "Hello" }],
  ...over
});

describe("panel rendering", () => {
  it("draws every background without throwing", () => {
    for (const background of BACKGROUNDS) {
      const html = renderToStaticMarkup(
        <ComicPanel panel={panel({ background })} avatars={DEFAULT_PAIR} index={0} />
      );
      expect(html).toContain("<svg");
      expect(html.length).toBeGreaterThan(200);
    }
  });

  it("draws every pose and expression", () => {
    for (const pose of POSES) {
      for (const expression of EXPRESSIONS) {
        const html = renderToStaticMarkup(
          <svg>
            <CharacterArt avatar={DEFAULT_PAIR.a} pose={pose} expression={expression} />
          </svg>
        );
        expect(html).toContain("<path");
      }
    }
  });

  it("draws every hair style, skin tone and accessory", () => {
    for (const hair of HAIR_STYLES) {
      for (const accessory of ACCESSORIES) {
        const html = renderToStaticMarkup(
          <svg>
            <CharacterArt
              avatar={{ ...DEFAULT_PAIR.a, hair, accessory }}
              pose="standing"
              expression="happy"
            />
          </svg>
        );
        expect(html).toContain("<circle");
      }
    }
    for (const tone of SKIN_TONES) {
      const html = renderToStaticMarkup(
        <svg>
          <CharacterArt avatar={{ ...DEFAULT_PAIR.a, skin: tone.id }} pose="standing" expression="happy" />
        </svg>
      );
      expect(html).toContain(tone.fill);
    }
  });

  it("never emits an unresolved template or NaN coordinate", () => {
    // Catches a broken expression in a path: NaN silently produces nothing.
    for (const background of BACKGROUNDS) {
      const html = renderToStaticMarkup(
        <ComicPanel
          panel={panel({
            background,
            characters: [
              { who: "A", pose: "running", expression: "surprised", position: "left" },
              { who: "B", pose: "hugging", expression: "shy", position: "right" }
            ],
            dialogue: [
              { speaker: "A", text: "a".repeat(MAX_DIALOGUE_CHARS) },
              { speaker: "narrator", text: "Later that night" }
            ],
            caption: "A caption"
          })}
          avatars={DEFAULT_PAIR}
          index={0}
        />
      );
      expect(html).not.toContain("NaN");
      expect(html).not.toContain("undefined");
      expect(html).not.toContain("[object Object]");
      expect(html).not.toContain(".replace(");
    }
  });

  it("wraps the longest allowed line instead of letting it run off", () => {
    const html = renderToStaticMarkup(
      <ComicPanel
        panel={panel({ dialogue: [{ speaker: "A", text: "word ".repeat(16).trim() }] })}
        avatars={DEFAULT_PAIR}
        index={0}
      />
    );
    // More than one tspan means it wrapped rather than overflowing one line.
    expect((html.match(/<tspan/g) || []).length).toBeGreaterThan(1);
  });

  it("gives each character their own half on a video call", () => {
    const html = renderToStaticMarkup(
      <ComicPanel
        panel={panel({
          background: "videocall",
          characters: [
            { who: "A", pose: "onphone", expression: "happy", position: "left" },
            { who: "B", pose: "onphone", expression: "sleepy", position: "left" }
          ]
        })}
        avatars={DEFAULT_PAIR}
        index={0}
      />
    );
    expect(html).toContain("translate(75");
    expect(html).toContain("translate(225");
  });
});
