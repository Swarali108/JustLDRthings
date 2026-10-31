import { z } from "zod";

/**
 * AI Mixtape: shared types, and the matching rules that decide whether a song
 * the model named is a real song.
 *
 * Everything here is pure — no network, no clock, no randomness — so the
 * matching rules can be tested directly. That matters more than usual, because
 * these rules are the only thing standing between a hallucinated track and a
 * recipient being shown a song that does not exist.
 */

export const MAX_TRACKS = 10;
export const MIN_TRACKS = 1;
/** The model gets a hard budget of lookups, whatever it asks for. */
export const MAX_TOOL_CALLS = 12;

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/**
 * Strip the parts of a title that identify a *release* rather than a *song*.
 *
 * "Dancing On My Own (Radio Edit)" and "Dancing On My Own" are the same song;
 * "Lover (feat. Shawn Mendes)" and "Lover" are the same song. Bracketed
 * segments and trailing " - …" markers carry that kind of detail, so they go
 * before anything else — if punctuation were removed first the brackets would
 * be gone and the suffix would be indistinguishable from part of the title.
 */
function stripVersionMarkers(value: string): string {
  return value
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s[-–—]\s.*$/, " ")
    .replace(/\b(feat|ft|featuring|with)\b.*$/i, " ");
}

/**
 * Reduce a title or artist to a comparable form: lowercase, no version
 * markers, no punctuation, single spaces.
 *
 * Accents are folded too, so "Beyoncé" and "Beyonce" compare equal — the model
 * and the store disagree about those constantly.
 */
export function normalise(value: string): string {
  return (
    stripVersionMarkers(value)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      // Apostrophes are DELETED, not spaced: "don't" and "dont" are the same
      // word, and the model and the store disagree about them constantly (the
      // store also prefers the typographic ’). Spacing them instead would turn
      // "don't" into "don t" and silently drop a real song.
      .replace(/['‘’ʼ`]/g, "")
      // Everything else that is not a letter or digit separates words.
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * The lead artist only.
 *
 * A store credits a collaboration as "Artist A & Artist B" or
 * "Artist A, Artist B", while the model usually names just the one. Comparing
 * lead artists lets that through without loosening the check into "any
 * substring matches", which would let a fake through on a common word.
 */
export function primaryArtist(value: string): string {
  const lead = stripVersionMarkers(value).split(/\s*[&,x×]\s*|\s+and\s+/i)[0] ?? value;
  return normalise(lead);
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

export function titleMatches(proposed: string, candidate: string): boolean {
  const a = normalise(proposed);
  const b = normalise(candidate);
  return a.length > 0 && a === b;
}

export function artistMatches(proposed: string, candidate: string): boolean {
  if (normalise(proposed) === normalise(candidate)) return true;

  const a = primaryArtist(proposed);
  const b = primaryArtist(candidate);
  return a.length > 0 && a === b;
}

export interface SongCandidate {
  trackName: string;
  artistName: string;
  previewUrl?: string | null;
  artworkUrl100?: string | null;
  trackViewUrl?: string | null;
}

/**
 * Pick the first candidate whose title AND artist both match.
 *
 * Both must match. Title alone is not enough — covers and karaoke versions
 * share titles with the original, and the whole point is that the named artist
 * actually recorded it.
 */
export function findMatch(
  title: string,
  artist: string,
  candidates: SongCandidate[]
): SongCandidate | null {
  return (
    candidates.find(
      (c) =>
        titleMatches(title, c.trackName ?? "") && artistMatches(artist, c.artistName ?? "")
    ) ?? null
  );
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

/** A song the store confirmed exists. Built by the server, never by the model. */
export interface VerifiedSong {
  title: string;
  artist: string;
  previewUrl: string | null;
  artworkUrl: string | null;
  appleMusicUrl: string | null;
}

/** The key a proposed song is filed under while the run is in progress. */
export function songKey(title: string, artist: string): string {
  return `${normalise(title)}|${primaryArtist(artist)}`;
}

/**
 * What the model is asked to return at the end.
 *
 * Deliberately contains NO urls. The model names songs and says why; the server
 * attaches `previewUrl`, `artworkUrl` and `appleMusicUrl` from its own verified
 * lookup. A model cannot inject a link into the page if it is never asked for
 * one.
 */
export const modelMixtapeSchema = z.object({
  title: z.string().trim().min(1).max(80),
  dedication: z.string().trim().min(1).max(160),
  tracks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(160),
        artist: z.string().trim().min(1).max(160),
        reason: z.string().trim().min(1).max(220)
      })
    )
    .min(1)
    .max(MAX_TRACKS + 4)
});

export type ModelMixtape = z.infer<typeof modelMixtapeSchema>;

/** Apple's hosts. Anything else is not a link this app will render. */
export const APPLE_HOSTS = [
  "music.apple.com",
  "itunes.apple.com",
  "audio-ssl.itunes.apple.com",
  "is1-ssl.mzstatic.com",
  "is2-ssl.mzstatic.com",
  "is3-ssl.mzstatic.com",
  "is4-ssl.mzstatic.com",
  "is5-ssl.mzstatic.com"
] as const;

/**
 * An https URL on an Apple host, or null.
 *
 * Applied on the way in from iTunes and again when a guest link is decoded. The
 * second check is the one that matters: a shared mixtape travels in a URL that
 * whoever sends it can edit, so by the time it is rendered these values are
 * attacker-authored.
 */
export function safeAppleUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return (APPLE_HOSTS as readonly string[]).includes(url.hostname) ? value : null;
  } catch {
    return null;
  }
}

/** A track as stored and rendered. */
export const mixtapeTrackSchema = z.object({
  title: z.string().trim().min(1).max(160),
  artist: z.string().trim().min(1).max(160),
  reason: z.string().trim().max(220).default(""),
  previewUrl: z.preprocess(safeAppleUrl, z.string().nullable()).default(null),
  artworkUrl: z.preprocess(safeAppleUrl, z.string().nullable()).default(null),
  appleMusicUrl: z.preprocess(safeAppleUrl, z.string().nullable()).default(null)
});

export const mixtapeSchema = z.object({
  title: z.string().trim().min(1).max(80),
  dedication: z.string().trim().max(160).default(""),
  tracks: z.array(mixtapeTrackSchema).min(MIN_TRACKS).max(MAX_TRACKS),
  /** Shown to the user as "8 of 10 songs verified". */
  proposed: z.number().int().min(0).max(40).default(0),
  verified: z.number().int().min(0).max(40).default(0)
});

export type Mixtape = z.infer<typeof mixtapeSchema>;
export type MixtapeTrack = z.infer<typeof mixtapeTrackSchema>;

/**
 * Build the final mixtape from what the model returned and what was verified.
 *
 * The model's own list is treated as a *proposal*. A track survives only if the
 * server's verified map has it — so a song the model invented, however
 * confidently, cannot reach the page. The reason text is kept, because that is
 * the part the model is genuinely for.
 */
export function assembleMixtape(
  model: ModelMixtape,
  verified: Map<string, VerifiedSong>
): Mixtape {
  const tracks: MixtapeTrack[] = [];

  for (const track of model.tracks) {
    if (tracks.length >= MAX_TRACKS) break;
    const found = verified.get(songKey(track.title, track.artist));
    if (!found) continue;

    // Duplicate proposals of the same song collapse to one.
    if (tracks.some((t) => songKey(t.title, t.artist) === songKey(found.title, found.artist))) {
      continue;
    }

    tracks.push({
      // Prefer the store's spelling: it is the authoritative one.
      title: found.title,
      artist: found.artist,
      reason: track.reason,
      previewUrl: found.previewUrl,
      artworkUrl: found.artworkUrl,
      appleMusicUrl: found.appleMusicUrl
    });
  }

  return {
    title: model.title,
    dedication: model.dedication,
    tracks,
    proposed: model.tracks.length,
    verified: tracks.length
  };
}
