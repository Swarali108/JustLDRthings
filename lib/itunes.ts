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
const RESULT_LIMIT = 5;

export interface SearchOutcome {
  verified: boolean;
  song: VerifiedSong | null;
  /** Why it failed, for the log and for the message handed back to the model. */
  reason: "match" | "no-results" | "no-match" | "timeout" | "error";
}

/** Artwork comes back at 100px; the same URL serves larger sizes. */
function upscaleArtwork(url: string | null): string | null {
  return url ? url.replace(/\/\d+x\d+bb\.(jpg|png)$/, "/300x300bb.$1") : null;
}

/**
 * Look a song up and decide whether it is real.
 *
 * `fetchImpl` is injectable so the tests can run the whole verification path —
 * including the fake-song case — without touching the network.
 */
export async function searchSong(
  title: string,
  artist: string,
  fetchImpl: typeof fetch = fetch
): Promise<SearchOutcome> {
  const term = `${title} ${artist}`.trim();
  if (!term) return { verified: false, song: null, reason: "no-results" };

  const url = `${ITUNES_ENDPOINT}?entity=song&limit=${RESULT_LIMIT}&term=${encodeURIComponent(term)}`;

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

    const hit = findMatch(title, artist, results);
    if (!hit) return { verified: false, song: null, reason: "no-match" };

    return {
      verified: true,
      reason: "match",
      song: {
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
