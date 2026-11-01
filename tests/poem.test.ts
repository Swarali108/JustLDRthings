import { describe, it, expect } from "vitest";
import {
  keyTokens,
  detailUsed,
  detailsUsedIn,
  missingDetailsHint,
  wholePoem,
  MIN_DETAILS_USED,
  type Detail
} from "@/lib/poem";

/**
 * This check is what stops the feature returning a poem that could have been
 * written for anyone. It is the poem equivalent of the mixtape's song
 * verification, and it is tested the same way.
 */

const d = (kind: Detail["kind"], value: string): Detail => ({ kind, value });

describe("keyTokens", () => {
  it("keeps the distinctive words and drops the filler", () => {
    expect(keyTokens("we met in Pune during the monsoon")).toEqual([
      "met",
      "pune",
      "during",
      "monsoon"
    ]);
  });

  it("folds case, accents and apostrophes", () => {
    expect(keyTokens("Café mornings")).toEqual(["cafe", "mornings"]);
    expect(keyTokens("don't stop")).toEqual(["dont", "stop"]);
  });

  it("returns nothing for a value made only of filler", () => {
    expect(keyTokens("the time we")).toEqual([]);
  });
});

describe("detailUsed", () => {
  const poem = `Meera, the rain still finds me here,
a bookshop door, a July sky —
I keep the monsoon in my ear
and call you bun when no one's by.`;

  it("finds a name, a nickname and a place-ish word", () => {
    expect(detailUsed(d("name", "Meera"), poem)).toBe(true);
    expect(detailUsed(d("nickname", "bun"), poem)).toBe(true);
    expect(detailUsed(d("date", "July"), poem)).toBe(true);
  });

  it("counts a memory when one of its distinctive words appears", () => {
    // The poem does not quote the memory, and should not have to.
    expect(detailUsed(d("memory", "we met outside a bookshop in the rain"), poem)).toBe(true);
  });

  it("does not count a detail that is absent", () => {
    expect(detailUsed(d("place", "Lisbon"), poem)).toBe(false);
    expect(detailUsed(d("nickname", "pickle"), poem)).toBe(false);
  });

  it("matches whole words only", () => {
    // "bun" must not be found inside "bundle".
    expect(detailUsed(d("nickname", "bun"), "I carry a bundle of letters")).toBe(false);
  });

  it("requires every word of a name, nickname or place", () => {
    // An identifier half-said is a different thing.
    expect(detailUsed(d("place", "New York"), "a new morning")).toBe(false);
    expect(detailUsed(d("place", "New York"), "New York in the rain")).toBe(true);
    expect(detailUsed(d("name", "Meera Rao"), "Meera, still")).toBe(false);
  });

  it("accepts part of a date, because poems rarely say the year", () => {
    expect(detailUsed(d("date", "July 2023"), "a July sky")).toBe(true);
    expect(detailUsed(d("date", "July 2023"), "back in 2023")).toBe(true);
    expect(detailUsed(d("date", "July 2023"), "a August sky")).toBe(false);
  });

  it("accepts a rephrased memory or joke", () => {
    // The poem uses the memory; it does not quote it.
    expect(detailUsed(d("joke", "the broken umbrella"), "the umbrella that never opened")).toBe(true);
    expect(detailUsed(d("memory", "Pune monsoon"), "the monsoon came early")).toBe(true);
    expect(detailUsed(d("memory", "Pune monsoon"), "a quiet winter")).toBe(false);
  });

  it("is false for a detail with no distinctive words at all", () => {
    expect(detailUsed(d("memory", "the time we"), poem)).toBe(false);
  });
});

describe("detailsUsedIn", () => {
  const details = [
    d("name", "Meera"),
    d("nickname", "bun"),
    d("place", "Pune"),
    d("date", "July 2023"),
    d("joke", "the broken umbrella")
  ];

  it("returns only the ones actually present", () => {
    const poem = "Meera in July, and the umbrella that never opened.";
    const used = detailsUsedIn(poem, details);
    expect(used.map((x) => x.value).sort()).toEqual(["July 2023", "Meera", "the broken umbrella"]);
  });

  it("can report fewer than the minimum, so the caller can ask again", () => {
    const generic = "The moon is far, the night is long, I miss you.";
    expect(detailsUsedIn(generic, details).length).toBeLessThan(MIN_DETAILS_USED);
  });
});

describe("missingDetailsHint", () => {
  const details = [d("name", "Meera"), d("place", "Pune"), d("nickname", "bun")];

  it("names what was used and what still needs working in", () => {
    const hint = missingDetailsHint("Meera, the night is long.", details);
    expect(hint).toContain("Meera");
    expect(hint).toContain("Pune");
    expect(hint).toContain("bun");
    expect(hint).toContain(String(MIN_DETAILS_USED));
  });

  it("copes with a poem that used nothing", () => {
    expect(missingDetailsHint("The moon is far.", details)).toContain("none");
  });
});

describe("wholePoem", () => {
  it("counts a detail that only appears in the title", () => {
    // A real poem came back titled "Under the Pune Moon" with Pune nowhere in
    // the body, and was scored as not having used it.
    const details = [d("place", "Pune"), d("nickname", "bun"), d("joke", "broken umbrella")];
    const title = "Under the Pune Moon";
    const body = "You, my sweet bun, beneath clouds that loom,\nour umbrella a comical sight.";

    expect(detailsUsedIn(body, details)).toHaveLength(2);
    expect(detailsUsedIn(wholePoem(title, body), details)).toHaveLength(3);
  });
});

describe("possessives", () => {
  it("counts a detail used in the possessive", () => {
    // "In Pune's rain" is a poem mentioning Pune.
    expect(detailUsed(d("place", "Pune"), "In Pune's rain we stood")).toBe(true);
    expect(detailUsed(d("name", "Meera"), "Meera's laugh")).toBe(true);
  });

  it("does not turn a different word into a match", () => {
    expect(detailUsed(d("place", "Pune"), "the punes were loud")).toBe(false);
  });
});
