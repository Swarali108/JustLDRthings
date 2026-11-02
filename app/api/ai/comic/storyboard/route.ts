import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, LIMITS, tierFor } from "@/lib/rate-limit";
import { identifyCaller } from "@/lib/ai/caller";
import { modelChat, VISION_MODEL } from "@/lib/ai/image-chat";
import { runStoryboard, STORYBOARD_TIMEOUT_MS } from "@/lib/ai/photo-comic-run";
import { PANEL_COUNTS, FREEDOMS, MIN_PHOTOS, MAX_PHOTOS } from "@/lib/photo-comic";

/**
 * POST /api/ai/comic/storyboard — read the photos, write the script.
 *
 * The cheap half. Separate from drawing so the story can be rewritten and
 * edited for fractions of a cent before anyone pays for a picture of it.
 */

export const maxDuration = 90;

const dataUrl = z
  .string()
  .max(2_600_000)
  .refine((v) => /^data:image\/(png|jpeg|webp);base64,/.test(v), "not an image");

const requestSchema = z.object({
  memory: z.string().trim().min(30, "Tell me a bit more about it.").max(1500),
  photos: z.array(z.object({ dataUrl })).min(MIN_PHOTOS).max(MAX_PHOTOS),
  panels: z.union([z.literal(4), z.literal(6), z.literal(8)]).default(4),
  freedom: z.enum(FREEDOMS).default("balanced"),
  names: z
    .object({ a: z.string().trim().max(24).default(""), b: z.string().trim().max(24).default("") })
    .default({ a: "", b: "" }),
  /** Explicit, per-request. Photographs are not sent without it. */
  consent: z.literal(true)
});

export async function POST(request: Request) {
  const caller = await identifyCaller(request, "comic-story");
  const budget = tierFor(LIMITS.comicStoryboard, caller.signedIn);
  const gate = rateLimit(caller.key, budget.limit, budget.windowMs);

  if (!gate.ok) {
    return NextResponse.json(
      { error: `That's a lot of drafts ♡ Try again in about ${Math.ceil(gate.retryAfter / 60)} minutes.` },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Comics aren't set up yet. ♡" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    // Consent is the one failure worth naming precisely: it is a refusal, not
    // a malformed field.
    const message =
      issue?.path.join(".") === "consent"
        ? "Your photos can't be sent without agreeing first."
        : issue?.message ?? "Bad request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { memory, photos, panels, freedom, names } = parsed.data;

  const result = await runStoryboard(
    memory,
    photos,
    panels,
    freedom,
    names,
    modelChat(apiKey, VISION_MODEL, STORYBOARD_TIMEOUT_MS)
  );

  console.info(
    JSON.stringify({
      at: "ai.comic.storyboard",
      userId: caller.userId,
      signedIn: caller.signedIn,
      ok: result.ok,
      ...(result.ok ? {} : { failure: result.error }),
      photos: photos.length,
      panels,
      freedom,
      attempts: result.stats.attempts,
      firstError: result.stats.firstError,
      latencyMs: result.stats.latencyMs,
      totalTokens: result.stats.totalTokens,
      costUsd: Number(result.stats.costUsd.toFixed(5))
    })
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: "Couldn't read those photos just then. Try again in a moment." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    storyboard: result.storyboard,
    stats: { latencyMs: result.stats.latencyMs, costUsd: result.stats.costUsd }
  });
}
