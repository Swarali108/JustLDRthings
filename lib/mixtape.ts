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

/** Word-boundary prefix: "chaudhvin ka chand" is a prefix of "... chand ho". */
function isWordPrefix(shorter: string, longer: string): boolean {
  return longer === shorter || longer.startsWith(shorter + " ");
}

/**
 * Titles match if they are the same, or if one is a word-boundary prefix of the
 * other and is at least three words long.
 *
 * The prefix rule exists because catalogues routinely carry a longer form of
 * the same song: "Chaudhvin Ka Chand" is listed as "Chaudhvin Ka Chand Ho", and
 * "Chura Liya Hai Tumne" as "Chura Liya Hai Tumne Jo Dil Ko". Requiring exact
 * equality rejected both, which is how a tape of real songs came back "1 of 3
 * verified".
 *
 * Three words is the floor, and it is the part doing the safety work: a
 * one- or two-word title ("Dreams", "Lover") prefixes far too many real songs,
 * so a short invented title could ride in on a coincidence. Three words of
 * exact agreement, in order, is not something a hallucination hits by accident.
 */
export function titleMatches(proposed: string, candidate: string): boolean {
  const a = normalise(proposed);
  const b = normalise(candidate);
  if (a.length === 0 || b.length === 0) return false;
  if (a === b) return true;

  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (shorter.split(" ").length < 3) return false;
  return isWordPrefix(shorter, longer);
}

/**
 * Do two names refer to the same person, allowing for abbreviation?
 *
 * The surname must match exactly. Earlier names may be abbreviated, which is
 * the common real-world case this exists for: the model writes "Mohammed Rafi",
 * the store writes "Mohd. Rafi". Both reduce to a shared three-letter stem
 * ("moh"), while the surname pins the identity.
 *
 * Anchoring on the surname is what keeps this from going mushy — "The Weeknd"
 * and "The Beatles" share a leading word but differ in the last, so they do not
 * match, which a looser token-overlap rule would get wrong.
 */
function sameName(a: string, b: string): boolean {
  if (a === b) return true;

  const left = a.split(" ").filter(Boolean);
  const right = b.split(" ").filter(Boolean);
  if (left.length === 0 || right.length === 0) return false;

  // Surname must be identical.
  if (left[left.length - 1] !== right[right.length - 1]) return false;

  const leftRest = left.slice(0, -1);
  const rightRest = right.slice(0, -1);
  if (leftRest.length === 0 && rightRest.length === 0) return true;
  if (leftRest.length !== rightRest.length) return false;

  // Every earlier name must agree, or be an abbreviation of the other.
  return leftRest.every((token, i) => {
    const other = rightRest[i];
    if (token === other) return true;
    const [short, long] = token.length <= other.length ? [token, other] : [other, token];
    return short.length >= 3 && long.startsWith(short.slice(0, 3)) && long.length - short.length <= 6;
  });
}

export function artistMatches(proposed: string, candidate: string): boolean {
  if (sameName(normalise(proposed), normalise(candidate))) return true;
  return sameName(primaryArtist(proposed), primaryArtist(candidate));
}

export interface SongCandidate {
  trackName: string;
  artistName: string;
  previewUrl?: string | null;
  artworkUrl100?: string | null;
  trackViewUrl?: string | null;
}

/**
 * Words that mark a re-recording rather than the song someone meant.
 *
 * Stripping version markers (so "Dreams" matches "Dreams - 2004 Remaster") has
 * a side effect: a lofi or club edit matches the original title just as well,
 * and store relevance puts those first. Asked for 1970s Hindi film songs the
 * tape came back with "Dekha Ek Khwab - Lofi" and "Ye Shaam Mastani (Amapiano
 * Mix)" — both real, both the wrong record.
 */
const REMIX_WORDS = [
  "remix", "lofi", "lo fi", "mix", "cover", "karaoke", "instrumental",
  "tribute", "remaster", "reprise", "unplugged", "slowed", "reverb",
  "mashup", "edit", "version", "rework", "revisited", "amapiano"
];

/** Is this the plain record, or a re-recording of it? */
export function isPlainRecording(trackName: string): boolean {
  const extras = `${trackName.match(/\(([^)]*)\)/g)?.join(" ") ?? ""} ${
    trackName.match(/\[([^\]]*)\]/g)?.join(" ") ?? ""
  } ${trackName.match(/\s[-–—]\s(.*)$/)?.[1] ?? ""}`.toLowerCase();

  if (!extras.trim()) return true;
  return !REMIX_WORDS.some((w) => extras.includes(w));
}

export interface MatchResult {
  candidate: SongCandidate;
  /** False when the song is real but the model credited the wrong artist. */
  artistConfirmed: boolean;
}

/**
 * Find the song, preferring an exact title+artist match but accepting a title
 * match on its own.
 *
 * The strict rule — both must match or the song is dropped — turned out to
 * throw away real songs over bad credits. Asked for Hindi moon songs, the model
 * offered "Chand Mera Dil / Kumar Sanu" (it is Mohammed Rafi) and
 * "Kabhi Kabhi Aditi / A. R. Rahman" (he composed it; Rashid Ali sang it).
 * Both are real, both were dropped, and the user got a three-track tape.
 *
 * A title match already proves the song EXISTS, which is the claim this feature
 * actually makes. Who recorded it is then a fact the store knows better than
 * the model — so a mismatch corrects the credit rather than discarding the
 * song, and the page shows the store's artist. That is strictly more honest
 * than dropping it: nothing unreal gets through either way, and a cover is
 * displayed under the name of whoever really sang it.
 *
 * The anti-hallucination property is untouched. An invented title still matches
 * nothing and is still dropped.
 */
export function findMatch(
  title: string,
  artist: string,
  candidates: SongCandidate[]
): MatchResult | null {
  const titled = candidates.filter((c) => titleMatches(title, c.trackName ?? ""));
  if (titled.length === 0) return null;

  // Best first: the right artist AND the plain record, then either on its own.
  // A remix is only chosen when nothing else matched at all.
  const rank = (c: SongCandidate) =>
    (artistMatches(artist, c.artistName ?? "") ? 0 : 2) +
    (isPlainRecording(c.trackName ?? "") ? 0 : 1);

  const best = titled.reduce((a, b) => (rank(b) < rank(a) ? b : a));
  return { candidate: best, artistConfirmed: artistMatches(artist, best.artistName ?? "") };
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

/**
 * A YouTube search for the track, built by the server from the verified title
 * and artist.
 *
 * Apple's catalogue is thin for some repertoires — a lot of older Hindi film
 * music is on YouTube and nowhere else, and its 30-second preview is missing
 * even when the track exists. A search link is not a guarantee the video is
 * there, so it is labelled as a search rather than as the song, and it is never
 * used as evidence that a song is real: verification stays with iTunes.
 */
export function youtubeSearchUrl(title: string, artist: string): string {
  const q = encodeURIComponent(`${title} ${artist}`.trim());
  return `https://www.youtube.com/results?search_query=${q}`;
}

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
const LINK_HOSTS = ["www.youtube.com", "youtube.com", "music.youtube.com"] as const;

/** An https link to a host this app is willing to render. */
export function safeLinkUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const allowed = [...APPLE_HOSTS, ...LINK_HOSTS] as readonly string[];
    return allowed.includes(url.hostname) ? value : null;
  } catch {
    return null;
  }
}

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
  appleMusicUrl: z.preprocess(safeAppleUrl, z.string().nullable()).default(null),
  youtubeUrl: z.preprocess(safeLinkUrl, z.string().nullable()).default(null)
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
      appleMusicUrl: found.appleMusicUrl,
      // Built here, from the store's own spelling of the track.
      youtubeUrl: youtubeSearchUrl(found.title, found.artist)
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
