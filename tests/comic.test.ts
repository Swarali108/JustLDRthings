import { describe, it, expect } from "vitest";
import {
  bubbleFontSize,
  bubbleLines,
  layoutFor,
  modelComicSchema,
  MAX_DIALOGUE_CHARS,
  type ComicCharacter
} from "@/lib/comic";

const ch = (
  who: "A" | "B",
  position: ComicCharacter["position"]
): ComicCharacter => ({ who, pose: "standing", expression: "happy", position });

describe("bubbleFontSize", () => {
  it("shrinks as the text grows", () => {
    const short = bubbleFontSize("Hi!");
    const medium = bubbleFontSize("a".repeat(35));
    const long = bubbleFontSize("a".repeat(MAX_DIALOGUE_CHARS));

    expect(short).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(long);
  });

  it("never goes below a readable size, even at the schema's limit", () => {
    expect(bubbleFontSize("a".repeat(MAX_DIALOGUE_CHARS))).toBeGreaterThanOrEqual(10);
  });

  it("scales with the panel", () => {
    expect(bubbleFontSize("Hello", 600)).toBeCloseTo(bubbleFontSize("Hello", 300) * 2, 1);
  });
});

describe("bubbleLines", () => {
  it("counts wrapped lines", () => {
    expect(bubbleLines("short")).toBe(1);
    expect(bubbleLines("a".repeat(10) + " " + "b".repeat(10) + " " + "c".repeat(10), 26)).toBe(2);
  });

  it("gives a long word its own line rather than looping forever", () => {
    expect(bubbleLines("supercalifragilisticexpialidocious and more", 10)).toBeGreaterThan(1);
  });

  /**
   * The guarantee the brief asks for: a bubble must never overflow. With the
   * dialogue cap and the smallest font, the worst case still fits.
   */
  it("keeps the worst case inside a panel", () => {
    const worst = "a".repeat(MAX_DIALOGUE_CHARS);
    const size = bubbleFontSize(worst);
    const lines = bubbleLines(worst, Math.floor((300 * 0.42) / (size * 0.52)));
    expect(lines * size * 1.25 + 12).toBeLessThan(200);
  });
});

describe("layoutFor", () => {
  it("puts each character in their own half on a video call", () => {
    const placed = layoutFor([ch("A", "left"), ch("B", "left")], "videocall");
    expect(placed.map((p) => p.half)).toEqual(["left", "right"]);
    expect(placed[0].x).toBeLessThan(placed[1].x);
  });

  it("separates two characters that asked for the same spot", () => {
    const placed = layoutFor([ch("A", "center"), ch("B", "center")], "park");
    expect(Math.abs(placed[0].x - placed[1].x)).toBeGreaterThanOrEqual(20);
  });

  it("respects left and right when they differ", () => {
    const placed = layoutFor([ch("A", "left"), ch("B", "right")], "cafe");
    expect(placed[0].x).toBeLessThan(50);
    expect(placed[1].x).toBeGreaterThan(50);
  });

  it("centres a lone character", () => {
    expect(layoutFor([ch("A", "center")], "bedroom")[0].x).toBe(50);
  });
});

describe("modelComicSchema", () => {
  const valid = {
    title: "The delayed train",
    panels: [
      {
        background: "station",
        characters: [{ who: "B", pose: "sitting", expression: "sad", position: "center" }],
        dialogue: [{ speaker: "B", text: "Four hours." }],
        caption: "Tuesday"
      },
      {
        background: "videocall",
        characters: [
          { who: "A", pose: "onphone", expression: "happy", position: "left" },
          { who: "B", pose: "onphone", expression: "laughing", position: "right" }
        ],
        dialogue: [{ speaker: "A", text: "Then I'll wait too." }]
      }
    ]
  };

  it("accepts a well-formed script", () => {
    expect(modelComicSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an unknown background", () => {
    const bad = structuredClone(valid);
    bad.panels[0].background = "moonbase";
    const out = modelComicSchema.safeParse(bad);
    expect(out.success).toBe(false);
    if (out.success) return;
    expect(out.error.issues[0].path.join(".")).toContain("background");
  });

  it("rejects an unknown pose or expression", () => {
    const badPose = structuredClone(valid);
    badPose.panels[0].characters[0].pose = "cartwheeling";
    expect(modelComicSchema.safeParse(badPose).success).toBe(false);

    const badFace = structuredClone(valid);
    badFace.panels[0].characters[0].expression = "smouldering";
    expect(modelComicSchema.safeParse(badFace).success).toBe(false);
  });

  it("rejects an unknown speaker", () => {
    const bad = structuredClone(valid);
    bad.panels[0].dialogue[0].speaker = "narrator2";
    expect(modelComicSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects dialogue over the cap, so a bubble can always be sized", () => {
    const bad = structuredClone(valid);
    bad.panels[0].dialogue[0].text = "a".repeat(MAX_DIALOGUE_CHARS + 1);
    expect(modelComicSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects more than two characters in a panel", () => {
    const bad = structuredClone(valid);
    bad.panels[1].characters.push({
      who: "A",
      pose: "standing",
      expression: "happy",
      position: "center"
    });
    expect(modelComicSchema.safeParse(bad).success).toBe(false);
  });
});
