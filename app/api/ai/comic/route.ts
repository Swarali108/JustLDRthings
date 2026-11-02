import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, LIMITS, tierFor } from "@/lib/rate-limit";
import { identifyCaller } from "@/lib/ai/caller";
import { resolveProvider } from "@/lib/ai/provider";
import { runComic } from "@/lib/ai/comic-run";
import { PANEL_COUNTS, type PanelCount } from "@/lib/comic";
import type { ChatFn } from "@/lib/ai/mixtape-run";

/** POST /api/ai/comic — a memory in, a comic script out. */

export const maxDuration = 60;
const MODEL_TIMEOUT_MS = 45_000;

const requestSchema = z.object({
  memory: z.string().trim().min(30, "Tell me a bit more about it.").max(1200),
  panels: z.union([z.literal(2), z.literal(4), z.literal(6)]).default(4),
  names: z
    .object({ a: z.string().trim().max(24).default(""), b: z.string().trim().max(24).default("") })
    .default({ a: "", b: "" })
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
          JSON.stringify({ at: "ai.comic.upstream", status: res.status, detail: detail.slice(0, 300) })
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
  const caller = await identifyCaller(request, "comic");
  const budget = tierFor(LIMITS.comic, caller.signedIn);
  const gate = rateLimit(caller.key, budget.limit, budget.windowMs);

  if (!gate.ok) {
    return NextResponse.json(
      {
        error: `That's a few comics in a row ♡ Try again in about ${Math.ceil(
          gate.retryAfter / 60
        )} minutes.`
      },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Comics aren't set up yet — try another creator for now. ♡" },
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

  const panels = parsed.data.panels as PanelCount;
  if (!(PANEL_COUNTS as readonly number[]).includes(panels)) {
    return NextResponse.json({ error: "Pick 2, 4 or 6 panels." }, { status: 400 });
  }

  const result = await runComic(parsed.data.memory, panels, parsed.data.names, chatFor(apiKey));

  // `retriedOnInvalid` with `firstError` is the pair worth watching: a model
  // that starts inventing enum values shows up here before anyone complains.
  console.info(
    JSON.stringify({
      at: "ai.comic",
      userId: caller.userId,
      signedIn: caller.signedIn,
      panels,
      ok: result.ok,
      ...(result.ok ? {} : { failure: result.error }),
      attempts: result.stats.attempts,
      retriedOnInvalid: result.stats.retriedOnInvalid,
      firstError: result.stats.firstError,
      latencyMs: result.stats.latencyMs,
      totalTokens: result.stats.totalTokens
    })
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: "The comic maker had trouble just then. Try again in a moment." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    comic: result.comic,
    stats: {
      attempts: result.stats.attempts,
      retriedOnInvalid: result.stats.retriedOnInvalid,
      latencyMs: result.stats.latencyMs,
      totalTokens: result.stats.totalTokens
    }
  });
}
