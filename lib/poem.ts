import { z } from "zod";

/**
 * AI Poem: the shapes, and the check that the poem actually used their details.
 *
 * Two steps rather than one. Asked to "write a poem about this paragraph", a
 * model writes something that could be about anyone — moonlight, distance,
 * longing. Pulling the specifics out FIRST, then requiring the poem to contain
 * at least three of them, is what makes it theirs rather than generic.
 *
 * Everything here is pure, so the detail-matching can be tested directly. It is
 * the same arrangement as the mixtape: the model proposes, the server checks.
 */

export const DETAIL_KINDS = ["name", "nickname", "place", "date", "joke", "memory"] as const;
export type DetailKind = (typeof DETAIL_KINDS)[number];

export const DETAIL_LABELS: Record<DetailKind, string> = {
  name: "Name",
  nickname: "Nickname",
  place: "Place",
  date: "Date",
  joke: "Inside joke",
  memory: "Shared memory"
};

export const POEM_FORMS = ["rhyming", "haiku", "free"] as const;
export type PoemForm = (typeof POEM_FORMS)[number];

export const FORM_LABELS: Record<PoemForm, string> = {
  rhyming: "Short rhyming",
  haiku: "A set of haiku",
  free: "Free verse"
};

export const FORM_BRIEFS: Record<PoemForm, string> = {
  rhyming:
    "A short rhyming poem: 8 to 12 lines, a simple ABAB or AABB scheme, natural rather than sing-song.",
  haiku:
    "A set of exactly three haiku, each 5-7-5 syllables, separated by a blank line. No title inside the poem.",
  free: "Free verse: 10 to 16 lines, no rhyme scheme, plain and unadorned."
};

/** The minimum number of their own details a poem must contain to be sent. */
export const MIN_DETAILS_USED = 3;
export const MAX_DETAILS = 12;

// ---------------------------------------------------------------------------
// Step 1: what the model pulled out of the paragraph
// ---------------------------------------------------------------------------

export const detailSchema = z.object({
  kind: z.enum(DETAIL_KINDS),
  /** The detail itself, as short as it can be while still meaning something. */
  value: z.string().trim().min(1).max(120)
});

export type Detail = z.infer<typeof detailSchema>;

export const detailsSchema = z.object({
  details: z.array(detailSchema).max(MAX_DETAILS)
});

// ---------------------------------------------------------------------------
// Step 2: the poem
// ---------------------------------------------------------------------------

export const modelPoemSchema = z.object({
  title: z.string().trim().min(1).max(80),
  /** Lines separated by newlines; blank lines separate stanzas. */
  body: z.string().trim().min(20).max(2400)
});

export const poemSchema = z.object({
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(20).max(2400),
  form: z.enum(POEM_FORMS),
  /** The details the server confirmed are actually in the poem. */
  used: z.array(detailSchema).default([]),
  /** Everything step 1 found, so the creator can show what was left out. */
  found: z.array(detailSchema).default([])
});

export type Poem = z.infer<typeof poemSchema>;

// ---------------------------------------------------------------------------
// The check
// ---------------------------------------------------------------------------

/** Words too common to prove a detail was used. */
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "in", "on", "at", "to", "for",
  "with", "we", "us", "our", "you", "your", "i", "me", "my", "he", "she",
  "her", "him", "his", "they", "them", "it", "is", "are", "was", "were",
  "be", "been", "that", "this", "there", "then", "when", "where", "always",
  "every", "time", "day", "days", "night", "nights", "one", "about", "from",
  "like", "just", "very", "some", "into", "over", "after", "before", "its"
]);

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    // Possessives first, and the order matters: dropping the apostrophe on its
    // own leaves "punes", which whole-word matching then misses. A real poem
    // said "In Pune's rain" and was scored as not mentioning Pune.
    .replace(/['\u2018\u2019\u02bc]s(?=\s|$)/g, "")
    .replace(/['\u2018\u2019\u02bc]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The words in a detail that would prove it was used.
 *
 * A memory like "we met in Pune during the monsoon" cannot be required
 * verbatim — a poem that said it word for word would not be a poem. What can be
 * required is its distinctive words: "pune", "monsoon". Common words are
 * dropped, because a poem containing "the" proves nothing.
 */
export function keyTokens(value: string): string[] {
  return fold(value)
    .split(" ")
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

/**
 * Kinds that must appear in full, because a part of them is a different thing.
 *
 * "New York" is not used by a poem that says "new", and a nickname half-said is
 * not the nickname. These are identifiers: all or nothing.
 */
const EXACT_KINDS = new Set<DetailKind>(["name", "nickname", "place"]);

/**
 * Is this detail present in the poem?
 *
 * The rule depends on what KIND of thing it is, not on how long it is:
 *
 * - name, nickname, place — every distinctive word must be there. These are
 *   identifiers; half of one is a different thing.
 * - date — any part will do. A poem that says "July" has used "July 2023";
 *   demanding the year back would reject most real poems.
 * - joke, memory — any distinctive word will do, because the poem is meant to
 *   USE the memory, not quote it. "the umbrella that never opened" has plainly
 *   used "the broken umbrella".
 *
 * Matching is on whole words throughout, so "bun" is not found inside "bundle".
 */
export function detailUsed(detail: Detail, poem: string): boolean {
  const haystack = ` ${fold(poem)} `;
  const tokens = keyTokens(detail.value);
  if (tokens.length === 0) return false;

  const hasWord = (w: string) => haystack.includes(` ${w} `);

  return EXACT_KINDS.has(detail.kind) ? tokens.every(hasWord) : tokens.some(hasWord);
}

/** Which of their details the poem actually contains. */
export function detailsUsedIn(poem: string, details: Detail[]): Detail[] {
  return details.filter((d) => detailUsed(d, poem));
}

/**
 * The text a reader actually sees: the title counts.
 *
 * Checking only the body under-reported every time the model put a detail in
 * the title — a real poem came back "Under the Pune Moon" and was scored as
 * not having used Pune.
 */
export function wholePoem(title: string, body: string): string {
  return `${title}
${body}`;
}

/** A one-line summary for the model when a poem has to be rewritten. */
export function missingDetailsHint(poem: string, details: Detail[]): string {
  const used = detailsUsedIn(poem, details);
  const unused = details.filter((d) => !used.includes(d));
  return (
    `That poem only used ${used.length} of their details (${used
      .map((d) => d.value)
      .join(", ") || "none"}). ` +
    `It needs at least ${MIN_DETAILS_USED}. Rewrite it so it clearly includes more of these: ` +
    `${unused.map((d) => d.value).join("; ")}.`
  );
}
