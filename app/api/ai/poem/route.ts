import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, LIMITS, tierFor } from "@/lib/rate-limit";
import { identifyCaller } from "@/lib/ai/caller";
import { resolveProvider } from "@/lib/ai/provider";
import { runPoem } from "@/lib/ai/poem-run";
import { POEM_FORMS } from "@/lib/poem";
import type { ChatFn } from "@/lib/ai/mixtape-run";

/**
 * POST /api/ai/poem — two model calls: pull out their details, then write a
 * poem that uses at least three of them.
 *
 * Like the mixtape route this is only the edges — who is asking, how often,
 * and the HTTP shape. The two-step run and the check live in
 * `lib/ai/poem-run.ts`, with no request object in sight.
 */

export const maxDuration = 60;
const MODEL_TIMEOUT_MS = 40_000;

const requestSchema = z.object({
  paragraph: z.string().trim().min(40, "Tell me a bit more about them.").max(2000),
  form: z.enum(POEM_FORMS).default("rhyming")
});

function chatFor(apiKey: string): ChatFn {
  const provider = resolveProvider(apiKey);

  return async (body) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
    try {
      const res = await fetch(provider.url, {
        method: "POST",
        headers: provider.headers,
        body: JSON.stringify({ ...body, model: provider.model }),
        signal: controller.signal
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error(
          JSON.stringify({ at: "ai.poem.upstream", status: res.status, detail: detail.slice(0, 300) })
        );
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
  // Open to guests, like every creator; signing in only buys somewhere to keep
  // what you made. Guests are bucketed by IP on a tighter allowance.
  const caller = await identifyCaller(request, "poem");
  const budget = tierFor(LIMITS.poem, caller.signedIn);
  const gate = rateLimit(caller.key, budget.limit, budget.windowMs);

  if (!gate.ok) {
    return NextResponse.json(
      {
        error: `That's a few poems in a row ♡ Try again in about ${Math.ceil(
          gate.retryAfter / 60
        )} minutes.`
      },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Poems aren't set up yet — write it in your own words. ♡" },
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

  const result = await runPoem(parsed.data.paragraph, parsed.data.form, chatFor(apiKey));

  // `detailsUsed` against `detailsFound` is the number worth watching: a model
  // that starts writing generic verse shows up here before anyone complains.
  console.info(
    JSON.stringify({
      at: "ai.poem",
      userId: caller.userId,
      signedIn: caller.signedIn,
      form: parsed.data.form,
      ok: result.ok,
      ...(result.ok ? {} : { failure: result.error }),
      detailsFound: result.stats.detailsFound,
      detailsUsed: result.stats.detailsUsed,
      rewrites: result.stats.rewrites,
      latencyMs: result.stats.latencyMs,
      totalTokens: result.stats.totalTokens
    })
  );

  if (!result.ok) {
    const message =
      result.error === "too-few-details"
        ? "There isn't quite enough here to make it personal. Add a name, a place, or something you both remember."
        : "The poem maker had trouble just then. Try again in a moment.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({
    poem: result.poem,
    stats: {
      detailsFound: result.stats.detailsFound,
      detailsUsed: result.stats.detailsUsed,
      rewrites: result.stats.rewrites,
      latencyMs: result.stats.latencyMs,
      totalTokens: result.stats.totalTokens
    }
  });
}
