import {
  modelComicSchema,
  BACKGROUNDS,
  POSES,
  EXPRESSIONS,
  POSITIONS,
  SPEAKERS,
  MAX_DIALOGUE_CHARS,
  MAX_CAPTION_CHARS,
  MAX_LINES_PER_PANEL,
  type ModelComic,
  type PanelCount
} from "@/lib/comic";
import type { ChatFn } from "@/lib/ai/mixtape-run";

/**
 * One comic run: the model writes a script, the app draws it.
 *
 * The model never produces a picture. It picks from fixed lists — background,
 * pose, expression, position — and the SVG library renders the result. That is
 * what makes the two characters the same two people in every panel, and what
 * makes an invalid script a validation error rather than something strange on
 * the page.
 *
 * Invalid JSON or an enum value that is not on the list gets ONE retry, with
 * the validation error handed back verbatim. A model told exactly which field
 * is wrong usually fixes it; a model told "try again" usually does not.
 */

export const MAX_COMIC_TOKENS = 1600;

function systemPrompt(panels: PanelCount, nameA: string, nameB: string): string {
  const A = nameA || "A";
  const B = nameB || "B";

  return `You write a short comic strip about a couple in a long-distance relationship, from a memory one of them describes.

There are exactly two characters: "A" (${A}, the person writing) and "B" (${B}).

Write EXACTLY ${panels} panels telling one small story with a beginning and an end.

You may ONLY use these values:
- background: ${BACKGROUNDS.join(", ")}
- pose: ${POSES.join(", ")}
- expression: ${EXPRESSIONS.join(", ")}
- position: ${POSITIONS.join(", ")}
- speaker: ${SPEAKERS.join(", ")}

Rules:
- At most 2 characters in a panel, and at most ${MAX_LINES_PER_PANEL} lines of dialogue.
- Dialogue is at most ${MAX_DIALOGUE_CHARS} characters per line. Short lines read better in a bubble.
- caption is optional, at most ${MAX_CAPTION_CHARS} characters, for a time or place ("Three months later").
- Use "videocall" when they are talking from different places. In that background each one appears in their own half of the screen, so give it exactly two characters.
- Expressions should change across the panels; a strip where everyone is "happy" throughout is dull.
- Use the real detail from the memory. Never invent a fact about them.

Return ONLY a JSON object, no prose and no code fence:
{"title": string, "panels": [{"background": string, "characters": [{"who": "A"|"B", "pose": string, "expression": string, "position": string}], "dialogue": [{"speaker": "A"|"B"|"narrator", "text": string}], "caption": string}]}`;
}

export interface ComicStats {
  attempts: number;
  retriedOnInvalid: boolean;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** The first validation failure, when there was one. Useful in the log. */
  firstError: string | null;
}

export type ComicResult =
  | { ok: true; comic: ModelComic; stats: ComicStats }
  | { ok: false; error: string; stats: ComicStats };

function stripFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}

/** The validation failure, phrased so the model can act on it. */
function describeIssues(error: { issues: { path: (string | number)[]; message: string }[] }): string {
  return error.issues
    .slice(0, 6)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}

export async function runComic(
  memory: string,
  panels: PanelCount,
  names: { a: string; b: string },
  chat: ChatFn
): Promise<ComicResult> {
  const startedAt = Date.now();
  const stats: ComicStats = {
    attempts: 0,
    retriedOnInvalid: false,
    latencyMs: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    firstError: null
  };
  const finish = (): ComicStats => ({ ...stats, latencyMs: Date.now() - startedAt });

  const messages: Record<string, unknown>[] = [
    { role: "system", content: systemPrompt(panels, names.a, names.b) },
    { role: "user", content: memory }
  ];

  // Two attempts at most: the first, and one corrected by the actual error.
  for (let attempt = 0; attempt < 2; attempt++) {
    stats.attempts = attempt + 1;

    const response = (await chat({
      temperature: 0.9,
      max_tokens: MAX_COMIC_TOKENS,
      response_format: { type: "json_object" },
      messages
    })) ?? {};

    stats.promptTokens += response.usage?.prompt_tokens ?? 0;
    stats.completionTokens += response.usage?.completion_tokens ?? 0;
    stats.totalTokens += response.usage?.total_tokens ?? 0;

    if (response.error) return { ok: false, error: "model-error", stats: finish() };

    const text = (response.choices?.[0]?.message?.content ?? "").trim();
    if (!text) return { ok: false, error: "empty-answer", stats: finish() };

    let json: unknown;
    try {
      json = JSON.parse(stripFence(text));
    } catch {
      if (attempt === 0) {
        stats.firstError = "not valid JSON";
        stats.retriedOnInvalid = true;
        messages.push({ role: "assistant", content: text });
        messages.push({
          role: "user",
          content:
            "That was not valid JSON. Reply with ONLY the JSON object, no prose and no code fence."
        });
        continue;
      }
      return { ok: false, error: "bad-json", stats: finish() };
    }

    const parsed = modelComicSchema.safeParse(json);

    if (parsed.success) {
      // Panel count is asked for in the prompt but enforced here: a strip with
      // the wrong number of panels lays out wrong.
      const trimmed: ModelComic = {
        ...parsed.data,
        panels: parsed.data.panels.slice(0, panels)
      };
      return { ok: true, comic: trimmed, stats: finish() };
    }

    if (attempt === 0) {
      const detail = describeIssues(parsed.error);
      stats.firstError = detail;
      stats.retriedOnInvalid = true;

      messages.push({ role: "assistant", content: text });
      messages.push({
        role: "user",
        content:
          `That script was rejected: ${detail}. ` +
          `Fix exactly those fields and send the whole JSON again. ` +
          `Remember the only allowed values — background: ${BACKGROUNDS.join(", ")}; ` +
          `pose: ${POSES.join(", ")}; expression: ${EXPRESSIONS.join(", ")}; ` +
          `position: ${POSITIONS.join(", ")}; speaker: ${SPEAKERS.join(", ")}.`
      });
      continue;
    }

    return { ok: false, error: "schema", stats: finish() };
  }

  return { ok: false, error: "no-answer", stats: finish() };
}
