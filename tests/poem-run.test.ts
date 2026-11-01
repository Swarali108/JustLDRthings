import { describe, it, expect, vi } from "vitest";
import { runPoem } from "@/lib/ai/poem-run";
import type { ChatFn } from "@/lib/ai/mixtape-run";

/** The two-step flow, with a fake model. No network. */

const usage = { prompt_tokens: 80, completion_tokens: 40, total_tokens: 120 };

function reply(content: string) {
  return { choices: [{ message: { role: "assistant", content } }], usage };
}

const DETAILS = reply(
  JSON.stringify({
    details: [
      { kind: "name", value: "Meera" },
      { kind: "nickname", value: "bun" },
      { kind: "place", value: "Pune" },
      { kind: "date", value: "July 2023" }
    ]
  })
);

const PERSONAL = reply(
  JSON.stringify({
    title: "July, Pune",
    body: "Meera, the Pune rain in July\nstill calls you bun, and I reply."
  })
);

const GENERIC = reply(
  JSON.stringify({
    title: "Distance",
    body: "The moon is far tonight,\nand I am farther still."
  })
);

const PARA = "Her name is Meera, I call her bun. We met in Pune in July 2023.";

describe("runPoem", () => {
  it("extracts details, writes the poem, and reports which were used", async () => {
    const chat: ChatFn = vi.fn().mockResolvedValueOnce(DETAILS).mockResolvedValueOnce(PERSONAL);

    const result = await runPoem(PARA, "rhyming", chat);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.poem.title).toBe("July, Pune");
    expect(result.poem.form).toBe("rhyming");
    expect(result.poem.found).toHaveLength(4);
    expect(result.poem.used.map((u) => u.value).sort()).toEqual([
      "July 2023",
      "Meera",
      "Pune",
      "bun"
    ]);
    expect(result.stats.rewrites).toBe(0);
    expect(result.stats.totalTokens).toBe(240);
  });

  /** The case the two-step design exists for. */
  it("rejects a generic poem and asks once for a rewrite", async () => {
    const chat = vi
      .fn()
      .mockResolvedValueOnce(DETAILS)
      .mockResolvedValueOnce(GENERIC) // could be about anyone
      .mockResolvedValueOnce(PERSONAL) as unknown as ChatFn;

    const result = await runPoem(PARA, "free", chat);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.stats.rewrites).toBe(1);
    expect(result.poem.body).toContain("Meera");
    expect(result.poem.used.length).toBeGreaterThanOrEqual(3);
    // Three model calls: extract, generic attempt, rewrite.
    expect((chat as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(3);
  });

  it("only rewrites once, and returns the second attempt honestly", async () => {
    const chat = vi
      .fn()
      .mockResolvedValueOnce(DETAILS)
      .mockResolvedValue(GENERIC) as unknown as ChatFn;

    const result = await runPoem(PARA, "haiku", chat);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Returned rather than failed, but the count is truthful so the UI can say
    // "1 of 4 details woven in" and the user can decide.
    expect(result.stats.rewrites).toBe(1);
    expect(result.poem.used.length).toBeLessThan(3);
    expect((chat as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(3);
  });

  it("refuses when the paragraph has too little to work with", async () => {
    const chat: ChatFn = vi
      .fn()
      .mockResolvedValueOnce(reply(JSON.stringify({ details: [{ kind: "name", value: "Meera" }] })));

    const result = await runPoem("x".repeat(50), "rhyming", chat);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("too-few-details");
    // Never bothered writing a poem it could not make personal.
    expect((chat as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it("fails cleanly on non-JSON from the extraction step", async () => {
    const chat: ChatFn = vi.fn().mockResolvedValueOnce(reply("Sure! Here are the details."));
    const result = await runPoem(PARA, "rhyming", chat);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("bad-details-json");
  });

  it("fails cleanly on non-JSON from the poem step", async () => {
    const chat: ChatFn = vi
      .fn()
      .mockResolvedValueOnce(DETAILS)
      .mockResolvedValueOnce(reply("Here's your poem!"));
    const result = await runPoem(PARA, "rhyming", chat);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("bad-poem-json");
  });

  it("accepts a fenced JSON answer", async () => {
    const chat: ChatFn = vi
      .fn()
      .mockResolvedValueOnce(DETAILS)
      .mockResolvedValueOnce(
        reply('```json\n{"title":"T","body":"Meera in Pune, July, bun — the whole of it."}\n```')
      );
    const result = await runPoem(PARA, "free", chat);
    expect(result.ok).toBe(true);
  });

  it("reports a model error rather than throwing", async () => {
    const chat: ChatFn = vi.fn().mockResolvedValue({ error: { message: "upstream 500" } });
    const result = await runPoem(PARA, "rhyming", chat);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("model-error");
  });

  it("survives a provider returning nothing at all", async () => {
    const chat: ChatFn = vi.fn().mockResolvedValue(undefined as never);
    const result = await runPoem(PARA, "rhyming", chat);
    expect(result.ok).toBe(false);
  });
});
