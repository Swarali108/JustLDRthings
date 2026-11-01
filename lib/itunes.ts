import { findMatch, type SongCandidate, type VerifiedSong, safeAppleUrl } from "@/lib/mixtape";

/**
 * The one outside lookup a mixtape run makes: does this song exist?
 *
 * iTunes Search is free, needs no key and no account, which is why it is here
 * rather than Spotify — a verification step that itself needs credentials to be
 * provisioned would fail closed for every user who has not set them up, and
 * then nothing would ever verify.
 */

export const ITUNES_ENDPOINT = "https://itunes.apple.com/search";
export const ITUNES_TIMEOUT_MS = 15_000;
const RESULT_LIMIT = 8;

/**
 * Storefronts to try, in order, stopping at the first match.
 *
 * iTunes results are per-country and the catalogues genuinely differ: searching
 * the US store for "Chura Liya Hai Tumne" returns only remixes, while the
 * Indian store has the 1973 recording. Checking one store and giving up was
 * rejecting real songs as invented, which is the worst possible failure for
 * this feature.
 *
 * Ordered so the common case costs one request; a second store is only hit when
 * the first finds nothing that matches.
 */
export const ITUNES_STORES = (process.env.ITUNES_STORES || "US,IN")
  .split(",")
  .map((c) => c.trim().toUpperCase())
  .filter(Boolean);

export interface SearchOutcome {
  verified: boolean;
  song: VerifiedSong | null;
  /** Why it failed, for the log and for the message handed back to the model. */
  reason: "match" | "corrected" | "no-results" | "no-match" | "timeout" | "error";
  /** Set when the song is real but the model named the wrong artist. */
  correctedFrom?: string;
}

/** Artwork comes back at 100px; the same URL serves larger sizes. */
function upscaleArtwork(url: string | null): string | null {
  return url ? url.replace(/\/\d+x\d+bb\.(jpg|png)$/, "/300x300bb.$1") : null;
}

/** One storefront, one query. */
async function searchStore(
  title: string,
  artist: string,
  country: string,
  fetchImpl: typeof fetch,
  term: string
): Promise<SearchOutcome> {
  const url =
    `${ITUNES_ENDPOINT}?entity=song&limit=${RESULT_LIMIT}` +
    `&country=${encodeURIComponent(country)}&term=${encodeURIComponent(term)}`;

  // A hung lookup must not hold the whole request open: the model may ask for a
  // dozen of these, and the user is waiting on all of them.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ITUNES_TIMEOUT_MS);

  try {
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res.ok) return { verified: false, song: null, reason: "error" };

    const data = (await res.json()) as { results?: SongCandidate[] };
    const results = Array.isArray(data?.results) ? data.results : [];
    if (results.length === 0) return { verified: false, song: null, reason: "no-results" };

    const match = findMatch(title, artist, results);
    if (!match) return { verified: false, song: null, reason: "no-match" };

    const hit = match.candidate;
    return {
      verified: true,
      reason: match.artistConfirmed ? "match" : "corrected",
      ...(match.artistConfirmed ? {} : { correctedFrom: artist }),
      song: {
        // Always the store's spelling and the store's artist: it is the
        // authoritative record of who actually recorded this.
        title: hit.trackName,
        artist: hit.artistName,
        previewUrl: safeAppleUrl(hit.previewUrl),
        artworkUrl: upscaleArtwork(safeAppleUrl(hit.artworkUrl100)),
        appleMusicUrl: safeAppleUrl(hit.trackViewUrl)
      }
    };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return { verified: false, song: null, reason: aborted ? "timeout" : "error" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Look a song up across the configured storefronts and decide whether it is real.
 *
 * `fetchImpl` is injectable so the tests can run the whole verification path —
 * including the fake-song case — without touching the network.
 */
export async function searchSong(
  title: string,
  artist: string,
  fetchImpl: typeof fetch = fetch
): Promise<SearchOutcome> {
  if (!`${title} ${artist}`.trim()) {
    return { verified: false, song: null, reason: "no-results" };
  }

  let last: SearchOutcome = { verified: false, song: null, reason: "no-results" };

  /**
   * Queries, in order of precision.
   *
   * The artist is included first because it disambiguates ("Dreams" alone is
   * hundreds of songs). But a WRONG artist actively poisons the search: asked
   * for "Dil Dhoondta Hai / Mukhesh" — the model's misspelling of Mukesh —
   * iTunes returned nothing at all, and a real song was reported as invented.
   *
   * So the title alone is tried second. That is only safe because a title match
   * is now sufficient on its own and the credit is taken from the store (see
   * findMatch): searching by title cannot smuggle in a song that does not
   * exist, it can only find one the bad artist name was hiding.
   */
  const queries = [`${title} ${artist}`.trim(), title.trim()].filter(
    (q, i, all) => q.length > 0 && all.indexOf(q) === i
  );

  for (const term of queries) {
    for (const country of ITUNES_STORES) {
      const outcome = await searchStore(title, artist, country, fetchImpl, term);
      if (outcome.verified) return outcome;
      last = outcome;
    }
  }

  return last;
}
