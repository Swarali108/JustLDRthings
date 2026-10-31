import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, LIMITS, tierFor } from "@/lib/rate-limit";
import { identifyCaller } from "@/lib/ai/caller";
import { runMixtape, MIXTAPE_MODEL_TIMEOUT_MS, type ChatFn } from "@/lib/ai/mixtape-run";

/**
 * POST /api/ai/mixtape — turn a paragraph about someone into a verified mixtape.
 *
 * This route is only the edges: who is asking, how often they may ask, and the
 * HTTP shape of the answer. The conversation with the model and the verifying
 * of every song live in `lib/ai/mixtape-run.ts`, which has no request object in
 * it and can therefore be tested directly.
 */

export const maxDuration = 60;

const requestSchema = z.object({
  paragraph: z.string().trim().min(40, "Tell me a bit more about them.").max(2000)
});

/** The model call, with its own timeout. Injected into the run for tests. */
function openAiChat(apiKey: string): ChatFn {
  return async (body) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MIXTAPE_MODEL_TIMEOUT_MS);
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!res.ok) {
        return { error: { message: `upstream ${res.status}` } };
      }
      return await res.json();
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      return { error: { message: aborted ? "timeout" : "network" } };
    } finally {
      clearTimeout(timer);
    }
  };
}

export async function POST(request: Request) {
  // Open to guests: everything in this app is usable without an account, and
  // signing in only buys somewhere to keep what you made. Guests are bucketed
  // by IP and given a much tighter allowance — see lib/ai/caller.ts for what
  // that is and is not worth.
  const caller = await identifyCaller(request, "mixtape");
  const budget = tierFor(LIMITS.mixtape, caller.signedIn);
  const gate = rateLimit(caller.key, budget.limit, budget.windowMs);
  if (!gate.ok) {
    return NextResponse.json(
      {
        error: `That's a few mixtapes in a row ♡ Try again in about ${Math.ceil(
          gate.retryAfter / 60
        )} minutes.`
      },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Mixtapes aren't set up yet — pick the songs yourself for now. ♡" },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Bad request." },
      { status: 400 }
    );
  }

  const result = await runMixtape(parsed.data.paragraph, openAiChat(apiKey));

  // One line per run: what was asked for, what survived verification, what it
  // cost. `dropped` is the number worth watching — a model that starts
  // inventing songs shows up here before anyone complains.
  console.info(
    JSON.stringify({
      at: "ai.mixtape",
      userId: caller.userId,
      signedIn: caller.signedIn,
      ok: result.ok,
      ...(result.ok ? {} : { failure: result.error }),
      proposed: result.stats.proposed,
      verified: result.stats.verified,
      dropped: result.stats.dropped,
      toolCalls: result.stats.toolCalls,
      rounds: result.stats.rounds,
      latencyMs: result.stats.latencyMs,
      promptTokens: result.stats.promptTokens,
      completionTokens: result.stats.completionTokens,
      totalTokens: result.stats.totalTokens
    })
  );

  if (!result.ok) {
    const message =
      result.error === "none-verified"
        ? "None of those songs could be confirmed as real. Try describing them a bit differently."
        : "The mixtape maker had trouble just then. Try again in a moment.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({
    mixtape: result.mixtape,
    stats: {
      proposed: result.stats.proposed,
      verified: result.stats.verified,
      dropped: result.stats.dropped,
      latencyMs: result.stats.latencyMs,
      totalTokens: result.stats.totalTokens
    }
  });
}
