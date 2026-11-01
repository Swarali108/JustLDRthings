import { describe, it, expect, vi } from "vitest";
import { runMixtape, type ChatFn } from "@/lib/ai/mixtape-run";
import { MAX_TOOL_CALLS } from "@/lib/mixtape";
import { TARGET_TRACKS, MAX_NUDGES } from "@/lib/ai/mixtape-run";

/**
 * The whole run, with a fake model and a fake iTunes.
 *
 * Nothing here touches the network. `runMixtape` takes both the chat function
 * and the fetch used for lookups, which is exactly so this is possible.
 */

/** A fake iTunes that only knows about the songs it is given. */
function fakeItunes(known: { title: string; artist: string }[]) {
  return vi.fn(async (url: string | URL | Request) => {
    const term = new URL(String(url)).searchParams.get("term")?.toLowerCase() ?? "";
    const results = known
      .filter((k) => term.includes(k.title.toLowerCase()))
      .map((k) => ({
        trackName: k.title,
        artistName: k.artist,
        previewUrl: "https://audio-ssl.itunes.apple.com/clip.m4a",
        artworkUrl100: "https://is1-ssl.mzstatic.com/image/100x100bb.jpg",
        trackViewUrl: "https://music.apple.com/gb/album/x"
      }));
    return new Response(JSON.stringify({ results }), { status: 200 });
  }) as unknown as typeof fetch;
}

function toolCall(id: string, title: string, artist: string) {
  return {
    id,
    type: "function",
    function: { name: "search_song", arguments: JSON.stringify({ title, artist }) }
  };
}

const usage = { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 };

/**
 * A tape under TARGET_TRACKS gets sent back for more, so a mock that only
 * answers twice runs dry. `final()` is the terminal answer: it is returned for
 * every turn after the scripted ones, so the run settles once the nudges are
 * spent.
 */
function finalAnswer(
  tracks: { title: string; artist: string; reason: string }[],
  title = "T"
) {
  return {
    choices: [
      {
        message: {
          role: "assistant",
          content: JSON.stringify({ title, dedication: "d", tracks })
        }
      }
    ],
    usage
  };
}

describe("runMixtape", () => {
  it("verifies every song, nudges for a longer tape, then returns it", async () => {
    const chat: ChatFn = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: "assistant",
              tool_calls: [
                toolCall("1", "Cruel Summer", "Taylor Swift"),
                toolCall("2", "Dreams", "Fleetwood Mac")
              ]
            }
          }
        ],
        usage
      })
      .mockResolvedValue(
        finalAnswer([
          { title: "Cruel Summer", artist: "Taylor Swift", reason: "the summer we met" },
          { title: "Dreams", artist: "Fleetwood Mac", reason: "you played it on the call" }
        ], "Monsoon Tape")
      );

    const result = await runMixtape(
      "She loves Fleetwood Mac and we met one summer.",
      chat,
      fakeItunes([
        { title: "Cruel Summer", artist: "Taylor Swift" },
        { title: "Dreams", artist: "Fleetwood Mac" }
      ])
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.mixtape.tracks).toHaveLength(2);
    expect(result.mixtape.title).toBe("Monsoon Tape");
    expect(result.stats.verified).toBe(2);
    expect(result.stats.dropped).toBe(0);
    expect(result.stats.toolCalls).toBe(2);

    // Two tracks is under TARGET_TRACKS, so the run sends the model back for
    // more before settling. Each nudge is another model turn, and the token
    // total reflects that.
    expect(result.stats.nudges).toBe(MAX_NUDGES);
    expect(result.stats.totalTokens).toBe(150 * (2 + MAX_NUDGES));
  });

  it("does not nudge when the tape is already long enough", async () => {
    const songs = ["A Song", "B Song", "C Song", "D Song", "E Song", "F Song"];
    const chat: ChatFn = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: "assistant",
              tool_calls: songs.map((t, i) => toolCall(String(i), t, "Fleetwood Mac"))
            }
          }
        ],
        usage
      })
      .mockResolvedValue(
        finalAnswer(songs.map((t) => ({ title: t, artist: "Fleetwood Mac", reason: "r" })))
      );

    const result = await runMixtape(
      "x".repeat(50),
      chat,
      fakeItunes(songs.map((t) => ({ title: t, artist: "Fleetwood Mac" })))
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mixtape.tracks).toHaveLength(TARGET_TRACKS);
    expect(result.stats.nudges).toBe(0);
  });

  /** The case the whole design exists for. */
  it("DROPS a song the model invented, and never shows it", async () => {
    const chat: ChatFn = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: "assistant",
              tool_calls: [
                toolCall("1", "Dreams", "Fleetwood Mac"),
                toolCall("2", "Moonlight Over Pune", "Fleetwood Mac")
              ]
            }
          }
        ],
        usage
      })
      // The model names the fake song anyway, despite being told not to.
      .mockResolvedValue(
        finalAnswer([
          { title: "Dreams", artist: "Fleetwood Mac", reason: "real" },
          { title: "Moonlight Over Pune", artist: "Fleetwood Mac", reason: "invented" }
        ])
      );

    const result = await runMixtape(
      "We met in Pune.",
      chat,
      fakeItunes([{ title: "Dreams", artist: "Fleetwood Mac" }])
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.mixtape.tracks).toHaveLength(1);
    expect(result.mixtape.tracks[0].title).toBe("Dreams");
    expect(
      result.mixtape.tracks.some((t) => t.title === "Moonlight Over Pune")
    ).toBe(false);

    expect(result.stats.proposed).toBe(2);
    expect(result.stats.verified).toBe(1);
    expect(result.stats.dropped).toBe(1);
  });

  /**
   * CHANGED DELIBERATELY alongside findMatch: a real song with a wrong credit
   * is kept and the credit corrected, rather than dropped. See the note in
   * tests/mixtape-matching.test.ts.
   */
  it("keeps a real song the model mis-credited, showing the true artist", async () => {
    const chat: ChatFn = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [
          { message: { role: "assistant", tool_calls: [toolCall("1", "Dreams", "Taylor Swift")] } }
        ],
        usage
      })
      .mockResolvedValue(
        finalAnswer([{ title: "Dreams", artist: "Taylor Swift", reason: "r" }])
      );

    // iTunes has "Dreams", but by Fleetwood Mac, not Taylor Swift.
    const result = await runMixtape("x".repeat(50), chat, fakeItunes([
      { title: "Dreams", artist: "Fleetwood Mac" }
    ]));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mixtape.tracks).toHaveLength(1);
    // Shown under the name of whoever really recorded it.
    expect(result.mixtape.tracks[0].artist).toBe("Fleetwood Mac");
  });

  it("stops the model after its lookup budget, and still finishes", async () => {
    // Twenty DISTINCT songs in one turn; only MAX_TOOL_CALLS may run.
    // (Distinct matters: repeats are now served from cache and cost nothing.)
    const many = Array.from({ length: 20 }, (_, i) =>
      toolCall(String(i), `Song Number ${i}`, "Fleetwood Mac")
    );

    const chat: ChatFn = vi
      .fn()
      .mockResolvedValueOnce({ choices: [{ message: { role: "assistant", tool_calls: many } }], usage })
      // Names only songs that fit inside the budget, so they verify.
      .mockResolvedValue(
        finalAnswer(
          Array.from({ length: 6 }, (_, i) => ({
            title: `Song Number ${i}`,
            artist: "Fleetwood Mac",
            reason: "r"
          }))
        )
      );

    const itunes = fakeItunes(
      Array.from({ length: 20 }, (_, i) => ({ title: `Song Number ${i}`, artist: "Fleetwood Mac" }))
    );
    const result = await runMixtape("x".repeat(50), chat, itunes);

    expect(result.ok).toBe(true);
    // The model asked for 20; only MAX_TOOL_CALLS were ever run.
    expect(result.stats.toolCalls).toBe(MAX_TOOL_CALLS);
    expect(result.stats.lookups).toHaveLength(MAX_TOOL_CALLS);
  });

  /**
   * The model repeats itself — the same failed song twice in one real run —
   * and each repeat used to burn one of twelve chances.
   */
  it("serves a repeated lookup from cache without spending budget", async () => {
    const same = Array.from({ length: 8 }, (_, i) => toolCall(String(i), "Dreams", "Fleetwood Mac"));

    const chat: ChatFn = vi
      .fn()
      .mockResolvedValueOnce({ choices: [{ message: { role: "assistant", tool_calls: same } }], usage })
      .mockResolvedValue(finalAnswer([{ title: "Dreams", artist: "Fleetwood Mac", reason: "r" }]));

    const itunes = fakeItunes([{ title: "Dreams", artist: "Fleetwood Mac" }]);
    const result = await runMixtape("x".repeat(50), chat, itunes);

    expect(result.ok).toBe(true);
    // Eight asks for one song: one lookup, and one charge against the budget.
    expect(result.stats.toolCalls).toBe(1);
    expect(result.stats.lookups).toHaveLength(1);
  });

  it("fails cleanly when the model returns something that is not JSON", async () => {
    const chat: ChatFn = vi.fn().mockResolvedValue({
      choices: [{ message: { role: "assistant", content: "Here you go! Enjoy the tape." } }],
      usage
    });

    const result = await runMixtape("x".repeat(50), chat, fakeItunes([]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("bad-json");
  });

  it("accepts JSON the model wrapped in a code fence", async () => {
    const chat: ChatFn = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [
          { message: { role: "assistant", tool_calls: [toolCall("1", "Dreams", "Fleetwood Mac")] } }
        ],
        usage
      })
      // Answers every turn after the tool call, so the nudges settle.
      .mockResolvedValue({
        choices: [
          {
            message: {
              role: "assistant",
              content:
                '```json\n{"title":"T","dedication":"d","tracks":[{"title":"Dreams","artist":"Fleetwood Mac","reason":"r"}]}\n```'
            }
          }
        ],
        usage
      });

    const result = await runMixtape("x".repeat(50), chat, fakeItunes([
      { title: "Dreams", artist: "Fleetwood Mac" }
    ]));
    expect(result.ok).toBe(true);
  });

  it("survives an iTunes lookup that fails", async () => {
    const brokenItunes = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    const chat: ChatFn = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [
          { message: { role: "assistant", tool_calls: [toolCall("1", "Dreams", "Fleetwood Mac")] } }
        ],
        usage
      })
      .mockResolvedValue(
        finalAnswer([{ title: "Dreams", artist: "Fleetwood Mac", reason: "r" }])
      );

    const result = await runMixtape("x".repeat(50), chat, brokenItunes);
    // Unverifiable is treated exactly like unreal: it does not reach the page.
    expect(result.ok).toBe(false);
  });

  it("reports a model error rather than throwing", async () => {
    const chat: ChatFn = vi.fn().mockResolvedValue({ error: { message: "upstream 500" } });
    const result = await runMixtape("x".repeat(50), chat, fakeItunes([]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("model-error");
  });
});
