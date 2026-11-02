import { describe, it, expect } from "vitest";
import {
  buildPanelPrompt,
  storyboardSchema,
  ART_STYLE_BRIEFS,
  MAX_PHOTOS,
  MAX_DIALOGUE_CHARS,
  type Storyboard
} from "@/lib/photo-comic";
import { runDraw } from "@/lib/ai/photo-comic-run";

const board: Storyboard = {
  title: "The delayed train",
  panels: [
    {
      scene: "Meera sits on a platform bench with her suitcase, rain outside.",
      characters: "Meera alone, tired",
      dialogue: [{ speaker: "B", text: "Four more hours." }],
      caption: "Tuesday, 11pm",
      photo: 0
    },
    {
      scene: "Split screen video call, both lying down, phones propped up.",
      characters: "Both, on a call",
      dialogue: [
        { speaker: "A", text: "Then I'll wait with you." },
        { speaker: "narrator", text: "Neither of them slept." }
      ],
      photo: 2
    }
  ]
};

describe("buildDrawPrompt", () => {
  const prompt = buildPanelPrompt(board.panels[0], 0, 2, "warm-comic", { a: "Sid", b: "Meera" }, 3);
  const second = buildPanelPrompt(board.panels[1], 1, 2, "warm-comic", { a: "Sid", b: "Meera" }, 3);

  it("carries its own scene, and the dialogue only as a mood cue", () => {
    expect(prompt).toContain("rain outside");
    // The words reach the drawing as feeling, never as text to render.
    expect(prompt).toContain("Four more hours.");
    expect(prompt).toContain("do NOT write these words");
    // Each panel gets its own scene, not the whole script.
    expect(prompt).not.toContain("Split screen video call");
    expect(second).toContain("Split screen video call");
  });

  it("tells the model where this panel sits in the sequence", () => {
    expect(prompt).toContain("number 1 of 2");
    expect(second).toContain("number 2 of 2");
  });

  it("forbids text, which is the whole reason panels are drawn separately", () => {
    expect(prompt).toContain("NO TEXT");
    expect(prompt.toLowerCase()).toContain("no speech bubbles");
  });

  it("forbids internal framing, which it kept drawing anyway", () => {
    // A test page came back with an empty beige bar across the top of one
    // panel and another split into two framed scenes side by side. The app
    // draws the border; the drawing must only hold what sits inside it.
    expect(prompt).toContain("FILL THE FRAME");
    expect(prompt.toLowerCase()).toContain("bleeds to all four edges");
    expect(prompt.toLowerCase()).toContain("no letterboxing");
    expect(prompt.toLowerCase()).toContain("never split this image");
  });

  it("uses the real names rather than A and B", () => {
    expect(prompt).toContain("Sid");
    expect(prompt).toContain("Meera");
  });

  it("names which reference photo this panel draws on", () => {
    // 0-based in the data, 1-based in the instruction, because the photos are
    // described to the model as "numbered 1 to N".
    expect(prompt).toContain("reference photo 1");
    expect(second).toContain("reference photo 3");
  });

  it("includes the art direction for the chosen style", () => {
    expect(prompt).toContain(ART_STYLE_BRIEFS["warm-comic"].slice(0, 30));
    const manga = buildPanelPrompt(board.panels[0], 0, 2, "manga", { a: "", b: "" }, 2);
    expect(manga).toContain("manga");
  });

  it("demands character consistency, which is the whole point", () => {
    expect(prompt.toLowerCase()).toContain("recognisably themselves");
  });

  it("forbids collaging the photos in", () => {
    expect(prompt.toLowerCase()).toContain("do not photo-collage");
  });

  it("falls back to neutral labels when no names are given", () => {
    const anon = buildPanelPrompt(board.panels[0], 0, 2, "ink", { a: "", b: "" }, 2);
    expect(anon).toContain("the first person");
    expect(anon).toContain("the second person");
  });
});

describe("storyboardSchema", () => {
  it("accepts a well-formed board", () => {
    expect(storyboardSchema.safeParse(board).success).toBe(true);
  });

  it("rejects dialogue over the cap", () => {
    const bad = structuredClone(board);
    bad.panels[0].dialogue[0].text = "a".repeat(MAX_DIALOGUE_CHARS + 1);
    expect(storyboardSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a photo index outside the uploaded set", () => {
    const bad = structuredClone(board);
    bad.panels[0].photo = MAX_PHOTOS;
    expect(storyboardSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an unknown speaker", () => {
    const bad = structuredClone(board) as unknown as { panels: { dialogue: { speaker: string }[] }[] };
    bad.panels[0].dialogue[0].speaker = "dog";
    expect(storyboardSchema.safeParse(bad).success).toBe(false);
  });

  it("allows a panel with no photo and no dialogue", () => {
    const quiet = {
      title: "x",
      panels: [
        { scene: "An empty platform at dawn.", characters: "", dialogue: [], photo: null },
        { scene: "The train finally arrives.", characters: "", dialogue: [], photo: null }
      ]
    };
    expect(storyboardSchema.safeParse(quiet).success).toBe(true);
  });
});

describe("runDraw", () => {
  const photos = [{ dataUrl: "data:image/jpeg;base64,AAA" }, { dataUrl: "data:image/jpeg;base64,BBB" }];
  const names = { a: "Sid", b: "Meera" };

  /** A chat that answers each call from a queue of outcomes. */
  function fakeChat(outcomes: ("image" | "billing" | "fail")[]) {
    let n = 0;
    const seen: unknown[] = [];
    const chat = async (body: Record<string, unknown>) => {
      seen.push(body);
      const outcome = outcomes[n++] ?? "image";
      if (outcome === "billing") return { error: { message: "billing" } };
      if (outcome === "fail") return { error: { message: "upstream 500" } };
      return {
        choices: [{ message: { images: [{ image_url: { url: "data:image/png;base64,ZZZ" } }] } }],
        usage: { total_tokens: 10, cost: 0.039 }
      };
    };
    return { chat: chat as never, seen };
  }

  it("draws one image per panel and totals the cost", async () => {
    const { chat, seen } = fakeChat(["image", "image"]);
    const result = await runDraw(board, photos, "warm-comic", names, chat);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.images).toHaveLength(2);
    expect(result.images.every((i) => i.startsWith("data:image/"))).toBe(true);
    expect(result.stats.drawn).toBe(2);
    // Two panels, two paid calls — the cost must reflect that, not one call.
    expect(result.stats.costUsd).toBeCloseTo(0.078, 5);
    expect(seen).toHaveLength(2);
  });

  it("sends every reference photo with every panel, to keep faces stable", async () => {
    const { chat, seen } = fakeChat(["image", "image"]);
    await runDraw(board, photos, "warm-comic", names, chat);

    for (const body of seen as { messages: { content: { type: string }[] }[] }[]) {
      const images = body.messages[0].content.filter((p) => p.type === "image_url");
      expect(images).toHaveLength(photos.length);
    }
  });

  it("redraws only the panel asked for", async () => {
    const { chat, seen } = fakeChat(["image"]);
    const result = await runDraw(board, photos, "warm-comic", names, chat, [1]);

    expect(seen).toHaveLength(1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The slot that was not redrawn stays empty rather than shifting up, so the
    // caller can merge by index.
    expect(result.images[0]).toBe("");
    expect(result.images[1]).toContain("data:image/png");
    expect(result.stats.drawn).toBe(1);
  });

  it("keeps the panels that worked when one fails", async () => {
    const { chat } = fakeChat(["image", "fail"]);
    const result = await runDraw(board, photos, "warm-comic", names, chat);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.stats.drawn).toBe(1);
    // A gap, not a thrown-away comic: the user can redraw just that panel.
    expect(result.images[1]).toBe("");
  });

  it("reports running out of credit as its own failure, not a retryable one", async () => {
    const { chat } = fakeChat(["billing", "billing"]);
    const result = await runDraw(board, photos, "warm-comic", names, chat);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // 402 is not transient. Telling the user to try again would be false advice.
    expect(result.error).toBe("no-credit");
  });

  it("fails with no-image when the model simply returns nothing", async () => {
    const { chat } = fakeChat(["fail", "fail"]);
    const result = await runDraw(board, photos, "warm-comic", names, chat);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("no-image");
  });
});
