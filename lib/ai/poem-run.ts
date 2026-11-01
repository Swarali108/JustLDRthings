import {
  detailsSchema,
  modelPoemSchema,
  detailsUsedIn,
  missingDetailsHint,
  wholePoem,
  FORM_BRIEFS,
  MIN_DETAILS_USED,
  MAX_DETAILS,
  type Detail,
  type Poem,
  type PoemForm
} from "@/lib/poem";
import type { ChatFn } from "@/lib/ai/mixtape-run";

/**
 * One poem run, in two steps.
 *
 * Step 1 reads the paragraph and lists the specifics — names, nicknames,
 * places, dates, jokes, memories. Step 2 writes the poem and is told it must
 * use them. The server then checks whether it did, and asks once more if not.
 *
 * Doing it in one step produces a poem that could be about anybody. The
 * extraction is what makes the result theirs, and it is also what makes the
 * check possible: you cannot verify "is this personal" without first having a
 * list of what personal would mean here.
 *
 * Takes `chat` as an argument for the same reason the mixtape does — so the
 * whole two-step flow can be tested with no network.
 */

export const MAX_POEM_TOKENS = 700;
export const MAX_DETAIL_TOKENS = 400;

const EXTRACT_SYSTEM = `You read a paragraph someone wrote about their partner and pull out the specifics.

Return ONLY a JSON object, no prose and no code fence:
{"details": [{"kind": "name" | "nickname" | "place" | "date" | "joke" | "memory", "value": string}]}

Rules:
- Only what is actually in the paragraph. Never infer, guess or embellish.
- Keep each value short: a name, a place, a date, a few words for a joke or a memory.
- Prefer concrete, distinctive things. "Pune" is useful; "love" is not.
- At most ${MAX_DETAILS} details. If the paragraph is vague, return fewer — an empty list is a valid answer.`;

function poemSystem(form: PoemForm, details: Detail[]): string {
  const list = details.map((d) => `- ${d.kind}: ${d.value}`).join("\n");

  return `You write a short, personal poem from one partner to another in a long-distance relationship.

Form: ${FORM_BRIEFS[form]}

These are the real details about them. Use AT LEAST ${MIN_DETAILS_USED} of them, by name, so the poem could not be about anyone else:
${list}

Rules:
- Never invent a fact about them. If it is not in the list above, do not state it as true.
- You may invent imagery and feeling. You may not invent a place they went, a thing they said, or a date.
- Use their words where you can: a nickname should appear as the nickname.
- Warm and specific, never greeting-card.

Return ONLY a JSON object, no prose and no code fence:
{"title": string, "body": string}

"body" holds the poem with real newlines between lines, and a blank line between stanzas.`;

}

export interface PoemStats {
  detailsFound: number;
  detailsUsed: number;
  rewrites: number;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type PoemResult =
  | { ok: true; poem: Poem; stats: PoemStats }
  | { ok: false; error: string; stats: PoemStats };

function stripFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}

export async function runPoem(
  paragraph: string,
  form: PoemForm,
  chat: ChatFn
): Promise<PoemResult> {
  const startedAt = Date.now();
  const stats: PoemStats = {
    detailsFound: 0,
    detailsUsed: 0,
    rewrites: 0,
    latencyMs: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0
  };
  const finish = (): PoemStats => ({ ...stats, latencyMs: Date.now() - startedAt });

  function account(usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }) {
    stats.promptTokens += usage?.prompt_tokens ?? 0;
    stats.completionTokens += usage?.completion_tokens ?? 0;
    stats.totalTokens += usage?.total_tokens ?? 0;
  }

  // ---- step 1: the specifics ------------------------------------------------
  const extraction = (await chat({
    temperature: 0,
    max_tokens: MAX_DETAIL_TOKENS,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: EXTRACT_SYSTEM },
      { role: "user", content: paragraph }
    ]
  })) ?? {};

  account(extraction.usage);
  if (extraction.error) return { ok: false, error: "model-error", stats: finish() };

  const extractText = (extraction.choices?.[0]?.message?.content ?? "").trim();
  if (!extractText) return { ok: false, error: "no-details", stats: finish() };

  let detailsJson: unknown;
  try {
    detailsJson = JSON.parse(stripFence(extractText));
  } catch {
    return { ok: false, error: "bad-details-json", stats: finish() };
  }

  const parsedDetails = detailsSchema.safeParse(detailsJson);
  if (!parsedDetails.success) return { ok: false, error: "details-schema", stats: finish() };

  const details = parsedDetails.data.details;
  stats.detailsFound = details.length;

  // Without enough specifics there is nothing to make the poem theirs, and no
  // way to check that it is. Better to ask for more than to return something
  // that could have been written for anyone.
  if (details.length < MIN_DETAILS_USED) {
    return { ok: false, error: "too-few-details", stats: finish() };
  }

  // ---- step 2: the poem, then the check -------------------------------------
  const messages: Record<string, unknown>[] = [
    { role: "system", content: poemSystem(form, details) },
    { role: "user", content: paragraph }
  ];

  // One rewrite, no more: if two tries cannot work their details in, another
  // will not either, and the user is waiting.
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = (await chat({
      temperature: 0.85,
      max_tokens: MAX_POEM_TOKENS,
      response_format: { type: "json_object" },
      messages
    })) ?? {};

    account(response.usage);
    if (response.error) return { ok: false, error: "model-error", stats: finish() };

    const text = (response.choices?.[0]?.message?.content ?? "").trim();
    if (!text) return { ok: false, error: "empty-poem", stats: finish() };

    let poemJson: unknown;
    try {
      poemJson = JSON.parse(stripFence(text));
    } catch {
      return { ok: false, error: "bad-poem-json", stats: finish() };
    }

    const parsedPoem = modelPoemSchema.safeParse(poemJson);
    if (!parsedPoem.success) return { ok: false, error: "poem-schema", stats: finish() };

    const whole = wholePoem(parsedPoem.data.title, parsedPoem.data.body);
    const used = detailsUsedIn(whole, details);

    if (used.length >= MIN_DETAILS_USED) {
      stats.detailsUsed = used.length;
      return {
        ok: true,
        poem: { ...parsedPoem.data, form, used, found: details },
        stats: finish()
      };
    }

    // Not personal enough. Say exactly what is missing and ask again, once.
    if (attempt === 0) {
      stats.rewrites = 1;
      messages.push({ role: "assistant", content: text });
      messages.push({ role: "user", content: missingDetailsHint(whole, details) });
      continue;
    }

    // Second attempt also fell short. Return it anyway rather than nothing, but
    // report honestly how many of their details it managed — the creator shows
    // that number, so the user can judge it and ask again.
    stats.detailsUsed = used.length;
    return {
      ok: true,
      poem: { ...parsedPoem.data, form, used, found: details },
      stats: finish()
    };
  }

  return { ok: false, error: "no-poem", stats: finish() };
}
