import {
  storyboardSchema,
  buildPanelPrompt,
  ART_STYLE_BRIEFS,
  FREEDOM_BRIEFS,
  MAX_DIALOGUE_CHARS,
  MAX_PHOTOS,
  type Storyboard,
  type ArtStyle,
  type Freedom,
  type PanelCount
} from "@/lib/photo-comic";
import type { ChatFn } from "@/lib/ai/mixtape-run";

/**
 * Photo-to-comic, in two paid-for stages kept deliberately apart.
 *
 *   storyboard()  — a vision model reads the photos and writes the script.
 *                   Cheap (fractions of a cent) and fast, so it can be run
 *                   again freely while the user gets the story right.
 *   draw()        — the image model draws the page, with the photos attached
 *                   as references. ~$0.04 a go.
 *
 * Splitting them is the whole cost control: nobody pays for a drawing of a
 * story they did not want, and changing a line of dialogue does not silently
 * buy another image.
 */

export const STORYBOARD_TIMEOUT_MS = 60_000;
export const DRAW_TIMEOUT_MS = 180_000;
export const MAX_STORYBOARD_TOKENS = 1600;

/** An image the caller has already resized and encoded. */
export interface RefPhoto {
  /** data:image/...;base64,... */
  dataUrl: string;
}

function stripFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}

// ---------------------------------------------------------------------------
// Stage 1: read the photos, write the script
// ---------------------------------------------------------------------------

function storyboardSystem(
  panels: PanelCount,
  freedom: Freedom,
  names: { a: string; b: string }
): string {
  const A = names.a || "A";
  const B = names.b || "B";

  return `You are a comic writer. You are given photographs of a couple in a long-distance relationship and a memory one of them wrote.

Look at the photographs carefully. There are two recurring people: "A" (${A}, who wrote the memory) and "B" (${B}).

Write a storyboard of EXACTLY ${panels} panels with a beginning, a middle and an ending.

GROUNDING
${FREEDOM_BRIEFS[freedom]}

For each panel give:
- "scene": what the panel shows — place, action, mood. Write it for an illustrator. Max 220 characters.
- "characters": who is in the panel and what they are doing. Max 160 characters.
- "dialogue": up to 3 lines, each {"speaker": "A"|"B"|"narrator", "text": string}. Max ${MAX_DIALOGUE_CHARS} characters per line.
- "caption": optional, max 70 characters, for a time or place.
- "photo": the 0-based index of the uploaded photograph this panel draws on, or null. The photographs are numbered in the order they appear in this request.

Rules:
- Short, natural dialogue. People do not speak in captions.
- Vary the mood across panels. A strip where everyone is delighted throughout is dull.
- Never invent a significant event they did not describe or show.

Return ONLY a JSON object, no prose and no code fence:
{"title": string, "panels": [{"scene": string, "characters": string, "dialogue": [...], "caption": string, "photo": number|null}]}`;
}

export interface StoryboardStats {
  attempts: number;
  latencyMs: number;
  totalTokens: number;
  costUsd: number;
  firstError: string | null;
}

export type StoryboardResult =
  | { ok: true; storyboard: Storyboard; stats: StoryboardStats }
  | { ok: false; error: string; stats: StoryboardStats };

export async function runStoryboard(
  memory: string,
  photos: RefPhoto[],
  panels: PanelCount,
  freedom: Freedom,
  names: { a: string; b: string },
  chat: ChatFn
): Promise<StoryboardResult> {
  const startedAt = Date.now();
  const stats: StoryboardStats = {
    attempts: 0,
    latencyMs: 0,
    totalTokens: 0,
    costUsd: 0,
    firstError: null
  };
  const finish = (): StoryboardStats => ({ ...stats, latencyMs: Date.now() - startedAt });

  // The photographs go in as image parts, numbered in the text so the model can
  // refer back to them by index.
  const content: Record<string, unknown>[] = [
    { type: "text", text: `The memory:\n\n${memory}` },
    {
      type: "text",
      text: `${photos.length} photographs follow, numbered 1 to ${photos.length} in this order.`
    },
    ...photos.slice(0, MAX_PHOTOS).map((p) => ({
      type: "image_url",
      image_url: { url: p.dataUrl }
    }))
  ];

  const messages: Record<string, unknown>[] = [
    { role: "system", content: storyboardSystem(panels, freedom, names) },
    { role: "user", content }
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    stats.attempts = attempt + 1;

    const response = (await chat({
      temperature: 0.85,
      max_tokens: MAX_STORYBOARD_TOKENS,
      response_format: { type: "json_object" },
      messages
    })) ?? {};

    stats.totalTokens += response.usage?.total_tokens ?? 0;
    stats.costUsd += (response.usage as { cost?: number } | undefined)?.cost ?? 0;

    if (response.error) return { ok: false, error: "model-error", stats: finish() };

    const text = (response.choices?.[0]?.message?.content ?? "").trim();
    if (!text) return { ok: false, error: "empty-answer", stats: finish() };

    let json: unknown;
    try {
      json = JSON.parse(stripFence(text));
    } catch {
      if (attempt === 0) {
        stats.firstError = "not valid JSON";
        messages.push({ role: "assistant", content: text });
        messages.push({ role: "user", content: "That was not valid JSON. Reply with ONLY the JSON object." });
        continue;
      }
      return { ok: false, error: "bad-json", stats: finish() };
    }

    const parsed = storyboardSchema.safeParse(json);
    if (parsed.success) {
      return {
        ok: true,
        storyboard: { ...parsed.data, panels: parsed.data.panels.slice(0, panels) },
        stats: finish()
      };
    }

    if (attempt === 0) {
      const detail = parsed.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
      stats.firstError = detail;
      messages.push({ role: "assistant", content: text });
      messages.push({
        role: "user",
        content: `That storyboard was rejected: ${detail}. Fix those fields and send the whole JSON again.`
      });
      continue;
    }

    return { ok: false, error: "schema", stats: finish() };
  }

  return { ok: false, error: "no-answer", stats: finish() };
}

// ---------------------------------------------------------------------------
// Stage 2: draw it
// ---------------------------------------------------------------------------

export interface DrawStats {
  latencyMs: number;
  totalTokens: number;
  costUsd: number;
  bytes: number;
  /** How many panels came back drawn. */
  drawn: number;
}

export type DrawResult =
  | { ok: true; images: string[]; stats: DrawStats }
  | { ok: false; error: string; stats: DrawStats };

/** The shape OpenRouter returns a generated image in. */
interface ImageChoice {
  message?: {
    images?: { image_url?: { url?: string } }[];
  };
}

/**
 * Draw every panel.
 *
 * Panels run in PARALLEL. They are independent requests, each one takes ten to
 * twenty seconds, and doing them in sequence would make a six-panel comic a
 * two-minute wait. The same reference photographs go to every panel, which is
 * what keeps the two people looking like themselves across separate
 * generations.
 *
 * `only` redraws a subset: a single disappointing panel should not cost another
 * whole comic.
 */
export async function runDraw(
  storyboard: Storyboard,
  photos: RefPhoto[],
  style: ArtStyle,
  names: { a: string; b: string },
  chat: ChatFn,
  only?: number[]
): Promise<DrawResult> {
  const startedAt = Date.now();
  const stats: DrawStats = { latencyMs: 0, totalTokens: 0, costUsd: 0, bytes: 0, drawn: 0 };
  const finish = (): DrawStats => ({ ...stats, latencyMs: Date.now() - startedAt });

  const wanted = only?.length
    ? only.filter((i) => i >= 0 && i < storyboard.panels.length)
    : storyboard.panels.map((_, i) => i);

  const refs = photos.slice(0, MAX_PHOTOS).map((p) => ({
    type: "image_url",
    image_url: { url: p.dataUrl }
  }));

  const results = await Promise.all(
    wanted.map(async (index) => {
      const prompt = buildPanelPrompt(
        storyboard.panels[index],
        index,
        storyboard.panels.length,
        style,
        names,
        photos.length
      );

      const response = (await chat({
        modalities: ["image", "text"],
        messages: [{ role: "user", content: [{ type: "text", text: prompt }, ...refs] }]
      })) ?? {};

      const usage = response.usage as { cost?: number; total_tokens?: number } | undefined;
      const url = (response.choices?.[0] as ImageChoice | undefined)?.message?.images?.[0]
        ?.image_url?.url;

      return {
        index,
        url: url && url.startsWith("data:image/") ? url : null,
        tokens: usage?.total_tokens ?? 0,
        cost: usage?.cost ?? 0,
        reason: (response.error as { message?: string } | undefined)?.message ?? null
      };
    })
  );

  const images: string[] = new Array(storyboard.panels.length).fill("");
  for (const r of results) {
    stats.totalTokens += r.tokens;
    stats.costUsd += r.cost;
    if (r.url) {
      images[r.index] = r.url;
      stats.bytes += r.url.length;
      stats.drawn++;
    }
  }

  // Every panel failing is a failure; one failing is a gap the user can redraw.
  if (stats.drawn === 0) {
    // Out of credit is reported separately because it is the one failure here
    // that no retry fixes, and the owner — not the user — has to act on it.
    const billing = results.some((r) => r.reason === "billing");
    return { ok: false, error: billing ? "no-credit" : "no-image", stats: finish() };
  }

  return { ok: true, images, stats: finish() };
}

export { ART_STYLE_BRIEFS };
