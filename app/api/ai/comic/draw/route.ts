import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, LIMITS, tierFor } from "@/lib/rate-limit";
import { identifyCaller } from "@/lib/ai/caller";
import { modelChat, IMAGE_MODEL } from "@/lib/ai/image-chat";
import { runDraw, DRAW_TIMEOUT_MS } from "@/lib/ai/photo-comic-run";
import { storyboardSchema, ART_STYLES, MIN_PHOTOS, MAX_PHOTOS } from "@/lib/photo-comic";

/**
 * POST /api/ai/comic/draw — draw the page.
 *
 * The expensive half: about $0.04 a call, and it returns roughly a megabyte of
 * PNG. Deliberately a separate request from the storyboard so that editing a
 * line of dialogue never silently buys another drawing — a redraw is always
 * something the user chose.
 */

export const maxDuration = 300;

const dataUrl = z
  .string()
  .max(2_600_000)
  .refine((v) => /^data:image\/(png|jpeg|webp);base64,/.test(v), "not an image");

const requestSchema = z.object({
  storyboard: storyboardSchema,
  photos: z.array(z.object({ dataUrl })).min(MIN_PHOTOS).max(MAX_PHOTOS),
  style: z.enum(ART_STYLES).default("warm-comic"),
  names: z
    .object({ a: z.string().trim().max(24).default(""), b: z.string().trim().max(24).default("") })
    .default({ a: "", b: "" }),
  consent: z.literal(true),
  /** Redraw only these panel indexes. Omitted means the whole comic. */
  only: z.array(z.number().int().min(0).max(7)).max(8).optional()
});

export async function POST(request: Request) {
  const caller = await identifyCaller(request, "comic-draw");
  const budget = tierFor(LIMITS.comicDraw, caller.signedIn);
  const gate = rateLimit(caller.key, budget.limit, budget.windowMs);

  if (!gate.ok) {
    return NextResponse.json(
      {
        error: `Drawing takes a lot out of the machine ♡ Try again in about ${Math.ceil(
          gate.retryAfter / 60
        )} minutes.`
      },
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
    const message =
      issue?.path.join(".") === "consent"
        ? "Your photos can't be sent without agreeing first."
        : issue?.message ?? "Bad request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { storyboard, photos, style, names, only } = parsed.data;

  const result = await runDraw(
    storyboard,
    photos,
    style,
    names,
    modelChat(apiKey, IMAGE_MODEL, DRAW_TIMEOUT_MS),
    only
  );

  // Cost is logged per draw on purpose: this is the one route in the app that
  // spends real money per request, and the total is only visible if it is
  // written down somewhere.
  console.info(
    JSON.stringify({
      at: "ai.comic.draw",
      userId: caller.userId,
      signedIn: caller.signedIn,
      ok: result.ok,
      ...(result.ok ? {} : { failure: result.error }),
      photos: photos.length,
      panels: storyboard.panels.length,
      redrew: only?.length ?? null,
      drawn: result.stats.drawn,
      style,
      latencyMs: result.stats.latencyMs,
      totalTokens: result.stats.totalTokens,
      costUsd: Number(result.stats.costUsd.toFixed(5)),
      imageBytes: result.stats.bytes
    })
  );

  if (!result.ok) {
    if (result.error === "no-credit") {
      return NextResponse.json(
        { error: "Drawing is out of credit right now — nothing you did. Try again later. ♡" },
        { status: 503 }
      );
    }
    const message =
      result.error === "no-image"
        ? "The illustrator came back without a drawing. Try again, or try a different style."
        : "Drawing failed just then. Try again in a moment.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({
    images: result.images,
    stats: {
      latencyMs: result.stats.latencyMs,
      costUsd: Number(result.stats.costUsd.toFixed(5)),
      bytes: result.stats.bytes,
      drawn: result.stats.drawn
    }
  });
}
