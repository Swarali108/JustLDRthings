import { describe, it, expect, vi } from "vitest";
import { runMixtape, type ChatFn } from "@/lib/ai/mixtape-run";
import { MAX_TOOL_CALLS } from "@/lib/mixtape";

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

describe("runMixtape", () => {
  it("verifies every song, then returns the tape", async () => {
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
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: "assistant",
              content: JSON.stringify({
                title: "Monsoon Tape",
                dedication: "for the rainy season",
                tracks: [
                  { title: "Cruel Summer", artist: "Taylor Swift", reason: "the summer we met" },
                  { title: "Dreams", artist: "Fleetwood Mac", reason: "you played it on the call" }
                ]
              })
            }
          }
        ],
        usage
      });

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
    expect(result.stats.totalTokens).toBe(300);
    expect(result.stats.toolCalls).toBe(2);
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
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: "assistant",
              content: JSON.stringify({
                title: "Monsoon Tape",
                dedication: "for you",
                tracks: [
                  { title: "Dreams", artist: "Fleetwood Mac", reason: "real" },
                  { title: "Moonlight Over Pune", artist: "Fleetwood Mac", reason: "invented" }
                ]
              })
            }
          }
        ],
        usage
      });

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

  it("drops a cover credited to the wrong artist", async () => {
    const chat: ChatFn = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [
          { message: { role: "assistant", tool_calls: [toolCall("1", "Dreams", "Taylor Swift")] } }
        ],
        usage
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: "assistant",
              content: JSON.stringify({
                title: "T",
                dedication: "d",
                tracks: [{ title: "Dreams", artist: "Taylor Swift", reason: "r" }]
              })
            }
          }
        ],
        usage
      });

    // iTunes has "Dreams", but by Fleetwood Mac.
    const result = await runMixtape("x".repeat(50), chat, fakeItunes([
      { title: "Dreams", artist: "Fleetwood Mac" }
    ]));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("none-verified");
  });

  it("stops the model after its lookup budget, and still finishes", async () => {
    // Asks for 20 lookups in one turn; only MAX_TOOL_CALLS may run.
    const many = Array.from({ length: 20 }, (_, i) => toolCall(String(i), "Dreams", "Fleetwood Mac"));

    const chat: ChatFn = vi
      .fn()
      .mockResolvedValueOnce({ choices: [{ message: { role: "assistant", tool_calls: many } }], usage })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: "assistant",
              content: JSON.stringify({
                title: "T",
                dedication: "d",
                tracks: [{ title: "Dreams", artist: "Fleetwood Mac", reason: "r" }]
              })
            }
          }
        ],
        usage
      });

    const itunes = fakeItunes([{ title: "Dreams", artist: "Fleetwood Mac" }]);
    const result = await runMixtape("x".repeat(50), chat, itunes);

    expect(result.ok).toBe(true);
    expect(result.stats.toolCalls).toBe(MAX_TOOL_CALLS);
    expect((itunes as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(MAX_TOOL_CALLS);
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
      .mockResolvedValueOnce({
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
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: "assistant",
              content: JSON.stringify({
                title: "T",
                dedication: "d",
                tracks: [{ title: "Dreams", artist: "Fleetwood Mac", reason: "r" }]
              })
            }
          }
        ],
        usage
      });

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
