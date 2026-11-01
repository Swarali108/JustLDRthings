import {
  modelMixtapeSchema,
  assembleMixtape,
  songKey,
  MAX_TOOL_CALLS,
  type Mixtape,
  type VerifiedSong
} from "@/lib/mixtape";
import { searchSong } from "@/lib/itunes";

/**
 * One mixtape run: the model proposes songs, the server checks every one, and
 * only the ones that exist reach the page.
 *
 * Pulled out of the route handler so a test can drive the whole conversation —
 * tool calls, verification, assembly — with a fake model and a fake store, and
 * no Next.js request in sight. The route is then only auth, limits and HTTP.
 */

export const MIXTAPE_MODEL_TIMEOUT_MS = 45_000;
export const MAX_COMPLETION_TOKENS = 1200;

/** A tape shorter than this is not worth sending, so the run pushes back. */
export const TARGET_TRACKS = 6;
/** How many times the server will send the model back for more. */
export const MAX_NUDGES = 2;

const SYSTEM = `You build a mixtape for someone in a long-distance relationship, from a paragraph their partner wrote.

Rules:
- Aim for 8 songs. Your final answer must contain AT LEAST 6 tracks, and every one must have been confirmed found by search_song.
- Call search_song for every song before naming it. Never name a song you have not looked up.
- If a song is not found, DO NOT give up on it straight away. Try once more with a different spelling: the full title as it appears on the record, a common transliteration, or the artist's name as the label credits them. Then move on to a different song.
- Keep looking up new songs until you have at least 6 confirmed ones or you run out of lookups. Do not stop at 3.
- Use the artist's usual credited name. For older Hindi film songs the playback singer is the artist (Lata Mangeshkar, Mohammed Rafi, Kishore Kumar, Asha Bhosle), not the actor or the composer.
- Honour EVERY constraint in the paragraph, not just the mood. If they name a decade, the songs must be from that decade. If they name a language, every song must be in it. If they name a subject (the moon, rain, trains), every song must actually be about or clearly reference it.
- A song that misses a stated constraint is a worse answer than a shorter tape. Do not pad with popular songs that do not fit.
- Prefer songs that connect to something concrete in the paragraph: a place, a habit, a feeling, an era, a language or an artist they mention.
- Never invent songs, artists or lyrics.

When you have finished looking songs up, reply with ONLY a JSON object, no prose and no code fence:
{"title": string, "dedication": string, "tracks": [{"title": string, "artist": string, "reason": string}]}

"title" names the mixtape (max 80 chars). "dedication" is one line to the recipient (max 160 chars).
"reason" is ONE sentence tying that song to something specific in the paragraph (max 220 chars).`;

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_song",
      description:
        "Check that a song exists and get its details. Call once per song, before naming it in the final answer.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "The song title, without featured artists." },
          artist: { type: "string", description: "The main recording artist." }
        },
        required: ["title", "artist"],
        additionalProperties: false
      }
    }
  }
];

/** Minimal shapes of the bits of the chat-completions response that are used. */
interface ToolCall {
  id: string;
  type?: string;
  function: { name: string; arguments: string };
}
interface ChoiceMessage {
  role: string;
  content?: string | null;
  tool_calls?: ToolCall[];
}
interface ChatResponse {
  choices?: { message?: ChoiceMessage; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: { message?: string };
}

export type ChatFn = (body: Record<string, unknown>) => Promise<ChatResponse>;

/** One lookup, for the log. The failures are the interesting ones: they say
 *  what the model keeps proposing that cannot be confirmed. */
export interface LookupLog {
  title: string;
  artist: string;
  found: boolean;
  reason: string;
}

export interface RunStats {
  proposed: number;
  verified: number;
  dropped: number;
  toolCalls: number;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  rounds: number;
  /** How many times the run sent the model back for more songs. */
  nudges: number;
  lookups: LookupLog[];
}

export type RunResult =
  | { ok: true; mixtape: Mixtape; stats: RunStats }
  | { ok: false; error: string; stats: RunStats };

/** Strip a ```json fence if the model adds one despite being told not to. */
function stripFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}

export async function runMixtape(
  paragraph: string,
  chat: ChatFn,
  fetchImpl: typeof fetch = fetch
): Promise<RunResult> {
  const startedAt = Date.now();

  const verified = new Map<string, VerifiedSong>();
  /** Every lookup already made, so a repeat is answered without spending budget. */
  const attempted = new Map<string, string>();
  let nudges = 0;

  const stats: RunStats = {
    proposed: 0,
    verified: 0,
    dropped: 0,
    toolCalls: 0,
    latencyMs: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    rounds: 0,
    nudges: 0,
    lookups: []
  };

  const messages: Record<string, unknown>[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: paragraph }
  ];

  const finish = (): RunStats => ({ ...stats, latencyMs: Date.now() - startedAt });

  // Each round is one model turn. The loop ends when the model stops asking for
  // lookups, or when its lookup budget runs out — whichever comes first.
  for (let round = 0; round < MAX_TOOL_CALLS + MAX_NUDGES + 2; round++) {
    stats.rounds = round + 1;

    const budgetLeft = stats.toolCalls < MAX_TOOL_CALLS;

    const raw = await chat({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.8,
      max_tokens: MAX_COMPLETION_TOKENS,
      messages,
      ...(budgetLeft ? { tools: TOOLS, tool_choice: "auto" } : {})
    });

    // A provider that returns nothing usable must end the run, not throw out of
    // it: this is a network boundary and the body is not ours to trust.
    const response: ChatResponse = raw ?? {};

    stats.promptTokens += response.usage?.prompt_tokens ?? 0;
    stats.completionTokens += response.usage?.completion_tokens ?? 0;
    stats.totalTokens += response.usage?.total_tokens ?? 0;

    if (response.error) {
      return { ok: false, error: "model-error", stats: finish() };
    }

    const message = response.choices?.[0]?.message;
    if (!message) return { ok: false, error: "empty-response", stats: finish() };

    const calls = message.tool_calls ?? [];

    if (calls.length > 0) {
      messages.push({
        role: "assistant",
        content: message.content ?? null,
        tool_calls: calls
      });

      for (const call of calls) {
        // The budget is enforced here, not by asking the model nicely. Past it,
        // further calls are answered with a refusal so the model moves on.
        if (stats.toolCalls >= MAX_TOOL_CALLS) {
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ error: "lookup budget spent; finish with what you have" })
          });
          continue;
        }

        let args: { title?: unknown; artist?: unknown } = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          args = {};
        }
        const title = typeof args.title === "string" ? args.title : "";
        const artist = typeof args.artist === "string" ? args.artist : "";

        stats.toolCalls++;

        if (!title || !artist) {
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ found: false, reason: "title and artist are required" })
          });
          continue;
        }

        const key = songKey(title, artist);

        // The model repeats failed lookups — "Dil Dhoondta Hai" twice in one
        // run — and each repeat used to cost one of twelve chances. Answer
        // from what we already know and refund the budget.
        const seen = attempted.get(key);
        if (seen !== undefined) {
          stats.toolCalls--;
          const known = verified.get(key);
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(
              known
                ? { found: true, title: known.title, artist: known.artist, note: "already looked up" }
                : {
                    found: false,
                    reason: seen,
                    hint: "You already tried this one and it was not found. Choose a different song."
                  }
            )
          });
          continue;
        }

        const outcome = await searchSong(title, artist, fetchImpl);
        attempted.set(key, outcome.reason);
        stats.lookups.push({
          title,
          artist,
          found: outcome.verified,
          reason: outcome.reason
        });

        if (outcome.verified && outcome.song) {
          verified.set(key, outcome.song);
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({
              found: true,
              title: outcome.song.title,
              artist: outcome.song.artist,
              hasPreview: Boolean(outcome.song.previewUrl),
              ...(outcome.reason === "corrected"
                ? {
                    note: `The song is real but the artist you gave ("${outcome.correctedFrom}") was wrong. It is credited to ${outcome.song.artist}. Use that name, and make sure your reason does not say anything about the wrong artist.`
                  }
                : {})
            })
          });
        } else {
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({
              found: false,
              reason: outcome.reason,
              hint: "This song could not be confirmed. Do not use it."
            })
          });
        }
      }

      continue;
    }

    // No tool calls: this turn should be the final JSON.
    const text = (message.content ?? "").trim();
    if (!text) return { ok: false, error: "empty-answer", stats: finish() };

    let json: unknown;
    try {
      json = JSON.parse(stripFence(text));
    } catch {
      return { ok: false, error: "bad-json", stats: finish() };
    }

    const parsed = modelMixtapeSchema.safeParse(json);
    if (!parsed.success) return { ok: false, error: "schema", stats: finish() };

    const mixtape = assembleMixtape(parsed.data, verified);

    stats.proposed = parsed.data.tracks.length;
    stats.verified = mixtape.tracks.length;
    stats.dropped = stats.proposed - stats.verified;

    if (mixtape.tracks.length === 0) {
      return { ok: false, error: "none-verified", stats: finish() };
    }

    /**
     * Short tape? Send it back rather than accept it.
     *
     * The prompt asks for at least six confirmed tracks and the model routinely
     * answers with three — it looks a few songs up, hits a couple of misses and
     * calls it done. Asking more firmly in the prompt did not change that, so
     * the floor is enforced here: while there is lookup budget and a nudge
     * left, the run says exactly how many it has and sends it back for more.
     *
     * The same rule as everywhere else in this feature — the model proposes,
     * the server decides when it is finished.
     */
    if (
      mixtape.tracks.length < TARGET_TRACKS &&
      nudges < MAX_NUDGES &&
      stats.toolCalls < MAX_TOOL_CALLS
    ) {
      nudges++;
      stats.nudges = nudges;

      const have = mixtape.tracks.map((t) => `${t.title} by ${t.artist}`).join("; ");
      messages.push({ role: "assistant", content: text });
      messages.push({
        role: "user",
        content:
          `Only ${mixtape.tracks.length} of those were confirmed real, and the tape needs at least ${TARGET_TRACKS}. ` +
          `Keep these: ${have}. ` +
          `You have ${MAX_TOOL_CALLS - stats.toolCalls} lookups left — use them to find ${TARGET_TRACKS - mixtape.tracks.length} more songs that fit what they asked for, ` +
          `then reply with the full JSON including the kept ones. Do not repeat a song that was already not found.`
      });
      continue;
    }

    return { ok: true, mixtape, stats: finish() };
  }

  return { ok: false, error: "no-final-answer", stats: finish() };
}
