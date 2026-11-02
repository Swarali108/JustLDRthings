import { describe, it, expect, vi } from "vitest";
import { runComic } from "@/lib/ai/comic-run";
import type { ChatFn } from "@/lib/ai/mixtape-run";

/** The script run, with a fake model. No network. */

const usage = { prompt_tokens: 120, completion_tokens: 200, total_tokens: 320 };
const reply = (content: string) => ({
  choices: [{ message: { role: "assistant", content } }],
  usage
});

function script(panels: number, overrides: Record<string, unknown> = {}) {
  return {
    title: "The delayed train",
    panels: Array.from({ length: panels }, () => ({
      background: "station",
      characters: [{ who: "B", pose: "sitting", expression: "sad", position: "center" }],
      dialogue: [{ speaker: "B", text: "Four hours." }],
      ...overrides
    }))
  };
}

const NAMES = { a: "Sid", b: "Meera" };
const MEMORY = "Her train was delayed four hours and we stayed on call all night.";

describe("runComic", () => {
  it("returns a valid script on the first try", async () => {
    const chat: ChatFn = vi.fn().mockResolvedValue(reply(JSON.stringify(script(4))));

    const result = await runComic(MEMORY, 4, NAMES, chat);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.comic.panels).toHaveLength(4);
    expect(result.stats.attempts).toBe(1);
    expect(result.stats.retriedOnInvalid).toBe(false);
    expect(result.stats.totalTokens).toBe(320);
  });

  /** The retry the brief asks for, with the validation error fed back. */
  it("retries ONCE with the validation error when an enum is unknown", async () => {
    const bad = script(2, {
      background: "moonbase" // not on the list
    });

    const chat = vi
      .fn()
      .mockResolvedValueOnce(reply(JSON.stringify(bad)))
      .mockResolvedValueOnce(reply(JSON.stringify(script(2)))) as unknown as ChatFn;

    const result = await runComic(MEMORY, 2, NAMES, chat);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.stats.attempts).toBe(2);
    expect(result.stats.retriedOnInvalid).toBe(true);
    expect(result.stats.firstError).toContain("background");

    // The correction names the offending field, not just "try again".
    const calls = (chat as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const followUp = JSON.stringify(calls[1][0]);
    expect(followUp).toContain("background");
    expect(followUp).toContain("moonbase".length > 0 ? "rejected" : "");
  });

  it("retries once when the answer is not JSON at all", async () => {
    const chat = vi
      .fn()
      .mockResolvedValueOnce(reply("Here's your comic!"))
      .mockResolvedValueOnce(reply(JSON.stringify(script(2)))) as unknown as ChatFn;

    const result = await runComic(MEMORY, 2, NAMES, chat);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.stats.firstError).toBe("not valid JSON");
    expect(result.stats.attempts).toBe(2);
  });

  it("gives up after the second failure rather than looping", async () => {
    const bad = script(2, { background: "moonbase" });
    const chat = vi.fn().mockResolvedValue(reply(JSON.stringify(bad))) as unknown as ChatFn;

    const result = await runComic(MEMORY, 2, NAMES, chat);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("schema");
    expect((chat as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });

  it("trims a model that wrote more panels than asked for", async () => {
    const chat: ChatFn = vi.fn().mockResolvedValue(reply(JSON.stringify(script(6))));
    const result = await runComic(MEMORY, 2, NAMES, chat);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.comic.panels).toHaveLength(2);
  });

  it("accepts a fenced answer", async () => {
    const chat: ChatFn = vi
      .fn()
      .mockResolvedValue(reply("```json\n" + JSON.stringify(script(2)) + "\n```"));
    const result = await runComic(MEMORY, 2, NAMES, chat);
    expect(result.ok).toBe(true);
  });

  it("reports a model error rather than throwing", async () => {
    const chat: ChatFn = vi.fn().mockResolvedValue({ error: { message: "upstream 500" } });
    const result = await runComic(MEMORY, 4, NAMES, chat);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("model-error");
  });

  it("survives a provider returning nothing", async () => {
    const chat: ChatFn = vi.fn().mockResolvedValue(undefined as never);
    const result = await runComic(MEMORY, 4, NAMES, chat);
    expect(result.ok).toBe(false);
  });

  it("puts both characters' names in the prompt", async () => {
    const chat = vi.fn().mockResolvedValue(reply(JSON.stringify(script(2)))) as unknown as ChatFn;
    await runComic(MEMORY, 2, NAMES, chat);

    const system = JSON.stringify(
      (chat as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]
    );
    expect(system).toContain("Sid");
    expect(system).toContain("Meera");
  });
});
