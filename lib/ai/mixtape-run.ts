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

const SYSTEM = `You build a mixtape for someone in a long-distance relationship, from a paragraph their partner wrote.

Rules:
- Propose between 6 and 10 real, commercially released songs.
- Call search_song once for every song you propose, before naming it in your final answer. Never propose a song you have not looked up.
- If search_song says a song was not found, do not use it. Replace it with a different one, or leave it out.
- Prefer songs that connect to something concrete in the paragraph: a place, a habit, a feeling, an artist or a language they mention.
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
  const attempted = new Set<string>();

  const stats: RunStats = {
    proposed: 0,
    verified: 0,
    dropped: 0,
    toolCalls: 0,
    latencyMs: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    rounds: 0
  };

  const messages: Record<string, unknown>[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: paragraph }
  ];

  const finish = (): RunStats => ({ ...stats, latencyMs: Date.now() - startedAt });

  // Each round is one model turn. The loop ends when the model stops asking for
  // lookups, or when its lookup budget runs out — whichever comes first.
  for (let round = 0; round < MAX_TOOL_CALLS + 2; round++) {
    stats.rounds = round + 1;

    const budgetLeft = stats.toolCalls < MAX_TOOL_CALLS;

    const response = await chat({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.8,
      max_tokens: MAX_COMPLETION_TOKENS,
      messages,
      ...(budgetLeft ? { tools: TOOLS, tool_choice: "auto" } : {})
    });

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
        attempted.add(key);

        const outcome = await searchSong(title, artist, fetchImpl);

        if (outcome.verified && outcome.song) {
          verified.set(key, outcome.song);
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({
              found: true,
              title: outcome.song.title,
              artist: outcome.song.artist,
              hasPreview: Boolean(outcome.song.previewUrl)
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

    return { ok: true, mixtape, stats: finish() };
  }

  return { ok: false, error: "no-final-answer", stats: finish() };
}
