import { describe, it, expect } from "vitest";
import {
  normalise,
  primaryArtist,
  titleMatches,
  artistMatches,
  findMatch,
  assembleMixtape,
  safeAppleUrl,
  songKey,
  youtubeSearchUrl,
  safeLinkUrl,
  isPlainRecording,
  type VerifiedSong
} from "@/lib/mixtape";

/**
 * These rules decide whether a song the model named is real. They are the only
 * thing between a hallucinated track and a recipient, so they are tested
 * directly rather than only through the route.
 */

describe("normalise", () => {
  it("folds case, punctuation and accents", () => {
    expect(normalise("Beyoncé")).toBe("beyonce");
    expect(normalise("Don't Stop Me Now!")).toBe("dont stop me now");
    expect(normalise("  Spaced   Out  ")).toBe("spaced out");
  });

  it("deletes apostrophes rather than spacing them", () => {
    // The model writes "Dont", the store writes "Don’t". Both must land on
    // the same string or a real song gets dropped as unverifiable.
    expect(normalise("Don't Stop Me Now")).toBe("dont stop me now");
    expect(normalise("Don’t Stop Me Now")).toBe("dont stop me now");
    expect(normalise("Dont Stop Me Now")).toBe("dont stop me now");
  });

  it("drops release markers that are not part of the song", () => {
    expect(normalise("Lover (feat. Shawn Mendes)")).toBe("lover");
    expect(normalise("Dancing On My Own (Radio Edit)")).toBe("dancing on my own");
    expect(normalise("Dreams - 2004 Remaster")).toBe("dreams");
    expect(normalise("Landslide [Live]")).toBe("landslide");
    expect(normalise("Perfect ft. Beyoncé")).toBe("perfect");
  });
});

describe("primaryArtist", () => {
  it("keeps only the lead artist", () => {
    expect(primaryArtist("Florence + The Machine")).toBe("florence the machine");
    expect(primaryArtist("JAY-Z & Kanye West")).toBe("jay z");
    expect(primaryArtist("Calvin Harris, Dua Lipa")).toBe("calvin harris");
    expect(primaryArtist("Lady Gaga and Bradley Cooper")).toBe("lady gaga");
  });
});

describe("titleMatches", () => {
  it("accepts the same song under a different release name", () => {
    expect(titleMatches("Lover", "Lover (feat. Shawn Mendes)")).toBe(true);
    expect(titleMatches("Dreams", "Dreams - 2004 Remaster")).toBe(true);
  });

  it("rejects a different song", () => {
    expect(titleMatches("Lover", "Lover Boy")).toBe(false);
    expect(titleMatches("Style", "Wildest Dreams")).toBe(false);
  });

  it("rejects an empty title rather than matching everything", () => {
    expect(titleMatches("", "")).toBe(false);
  });
});

describe("artistMatches", () => {
  it("accepts the lead artist of a collaboration", () => {
    expect(artistMatches("Taylor Swift", "Taylor Swift & Bon Iver")).toBe(true);
    expect(artistMatches("JAY-Z", "Jay-Z, Alicia Keys")).toBe(true);
  });

  it("rejects an unrelated artist", () => {
    expect(artistMatches("Taylor Swift", "Olivia Rodrigo")).toBe(false);
  });

  it("does not match on a shared word", () => {
    // "The Weeknd" vs "The Beatles" share "the"; a substring rule would pass.
    expect(artistMatches("The Weeknd", "The Beatles")).toBe(false);
  });
});

describe("findMatch", () => {
  const results = [
    { trackName: "Cruel Summer", artistName: "Olivia Rodrigo" }, // cover: wrong artist
    { trackName: "Cruel Summer", artistName: "Taylor Swift", previewUrl: "https://audio-ssl.itunes.apple.com/x.m4a" },
    { trackName: "Cruel Summer (Live)", artistName: "Taylor Swift" }
  ];

  it("prefers the exact title+artist match over a same-title cover", () => {
    const hit = findMatch("Cruel Summer", "Taylor Swift", results);
    expect(hit?.candidate.artistName).toBe("Taylor Swift");
    expect(hit?.artistConfirmed).toBe(true);
    expect(hit?.candidate.previewUrl).toContain("audio-ssl.itunes.apple.com");
  });

  it("returns null when nothing matches", () => {
    expect(findMatch("Imaginary Song", "Taylor Swift", results)).toBeNull();
  });
});

describe("safeAppleUrl", () => {
  it("keeps https urls on Apple hosts", () => {
    expect(safeAppleUrl("https://music.apple.com/gb/album/x")).toBe(
      "https://music.apple.com/gb/album/x"
    );
  });

  it("rejects anything else, including javascript: and other hosts", () => {
    expect(safeAppleUrl("javascript:alert(1)")).toBeNull();
    expect(safeAppleUrl("https://evil.example.com/x.mp3")).toBeNull();
    expect(safeAppleUrl("http://music.apple.com/x")).toBeNull(); // not https
    expect(safeAppleUrl(42)).toBeNull();
    expect(safeAppleUrl(undefined)).toBeNull();
  });
});

describe("assembleMixtape", () => {
  const verified = new Map<string, VerifiedSong>();
  verified.set(songKey("Cruel Summer", "Taylor Swift"), {
    title: "Cruel Summer",
    artist: "Taylor Swift",
    previewUrl: "https://audio-ssl.itunes.apple.com/a.m4a",
    artworkUrl: "https://is1-ssl.mzstatic.com/image/300x300bb.jpg",
    appleMusicUrl: "https://music.apple.com/gb/album/a"
  });

  it("drops a track the server never verified", () => {
    const out = assembleMixtape(
      {
        title: "For You",
        dedication: "all my songs",
        tracks: [
          { title: "Cruel Summer", artist: "Taylor Swift", reason: "the summer we met" },
          { title: "Moonlight Over Pune", artist: "Taylor Swift", reason: "invented" }
        ]
      },
      verified
    );

    expect(out.tracks).toHaveLength(1);
    expect(out.tracks[0].title).toBe("Cruel Summer");
    expect(out.proposed).toBe(2);
    expect(out.verified).toBe(1);
  });

  it("takes urls from the verified store, never from the model", () => {
    const out = assembleMixtape(
      {
        title: "For You",
        dedication: "x",
        tracks: [{ title: "Cruel Summer", artist: "Taylor Swift", reason: "because" }]
      },
      verified
    );
    expect(out.tracks[0].previewUrl).toBe("https://audio-ssl.itunes.apple.com/a.m4a");
    expect(out.tracks[0].appleMusicUrl).toBe("https://music.apple.com/gb/album/a");
  });

  it("collapses a song proposed twice", () => {
    const out = assembleMixtape(
      {
        title: "For You",
        dedication: "x",
        tracks: [
          { title: "Cruel Summer", artist: "Taylor Swift", reason: "one" },
          { title: "cruel summer", artist: "taylor swift", reason: "again" }
        ]
      },
      verified
    );
    expect(out.tracks).toHaveLength(1);
  });
});

/**
 * The matching was loosened after a tape of real Hindi film songs came back
 * "1 of 3 verified". These pin both halves: the real songs now pass, and the
 * things that must still fail still fail.
 */
describe("matching real catalogue variations", () => {
  it("accepts a store title that extends the proposed one", () => {
    expect(titleMatches("Chaudhvin Ka Chand", "Chaudhvin Ka Chand Ho")).toBe(true);
    expect(titleMatches("Chura Liya Hai Tumne", "Chura Liya Hai Tumne Jo Dil Ko")).toBe(true);
  });

  it("accepts an abbreviated first name", () => {
    expect(artistMatches("Mohammed Rafi", "Mohd. Rafi")).toBe(true);
    expect(artistMatches("Mohd. Rafi", "Mohammed Rafi")).toBe(true);
    expect(artistMatches("Mohammad Rafi", "Mohd Rafi")).toBe(true);
  });

  it("still rejects a short title riding in on a prefix", () => {
    // Two words is below the floor: "Tum Hi" must not match "Tum Hi Ho Bandhu".
    expect(titleMatches("Tum Hi", "Tum Hi Ho Bandhu")).toBe(false);
    expect(titleMatches("Dreams", "Dreams Of Pune Nights")).toBe(false);
    expect(titleMatches("Lover", "Lover Boy Anthem")).toBe(false);
  });

  it("still rejects a different surname, however similar the rest", () => {
    expect(artistMatches("Mohammed Rafi", "Mohammed Aziz")).toBe(false);
    expect(artistMatches("Kishore Kumar", "Kumar Sanu")).toBe(false);
    expect(artistMatches("Lata Mangeshkar", "Asha Bhosle")).toBe(false);
  });

  it("still rejects an invented song that merely starts plausibly", () => {
    // A hallucination has to match three words exactly, in order, to get in.
    expect(titleMatches("Chaudhvin Ka Chand Over Pune", "Chaudhvin Ka Chand Ho")).toBe(false);
    expect(titleMatches("Moonlight Over Pune Nights", "Moonlight Sonata")).toBe(false);
  });

  /**
   * CHANGED DELIBERATELY. This used to assert the song was dropped.
   *
   * Dropping it meant a real moon song disappeared because the model guessed
   * the singer wrong, and the user got a three-track tape. A title match
   * already proves the song exists, so the credit is corrected from the store
   * instead — the page then shows whoever actually recorded it, which is more
   * honest than showing nothing.
   */
  it("keeps a song whose artist the model got wrong, and corrects the credit", () => {
    const hit = findMatch("Yeh Chand Sa Roshan Chehra", "Mohammed Rafi", [
      { trackName: "Yeh Chand Sa Roshan Chehra", artistName: "Rahul Pandey" }
    ]);
    expect(hit).not.toBeNull();
    expect(hit?.artistConfirmed).toBe(false);
    // The displayed artist is the store's, never the model's guess.
    expect(hit?.candidate.artistName).toBe("Rahul Pandey");
  });

  it("corrects a composer credited as the singer", () => {
    const hit = findMatch("Kabhi Kabhi Aditi", "A. R. Rahman", [
      { trackName: "Kabhi Kabhi Aditi Zindagi", artistName: "Rashid Ali" }
    ]);
    expect(hit?.artistConfirmed).toBe(false);
    expect(hit?.candidate.artistName).toBe("Rashid Ali");
  });

  it("STILL drops an invented title, whoever it is credited to", () => {
    // The protection that matters is untouched: no title match, no song.
    expect(
      findMatch("Moonlight Over Pune", "Mohammed Rafi", [
        { trackName: "Chand Mera Dil", artistName: "Mohd. Rafi" },
        { trackName: "Chaudhvin Ka Chand Ho", artistName: "Mohd. Rafi" }
      ])
    ).toBeNull();
  });
});

describe("youtubeSearchUrl", () => {
  it("builds a search from the verified title and artist", () => {
    const url = youtubeSearchUrl("Chura Liya Hai Tumne Jo Dil Ko", "Asha Bhosle & Mohd. Rafi");
    expect(url.startsWith("https://www.youtube.com/results?search_query=")).toBe(true);
    expect(url).toContain("Chura");
  });

  it("is accepted by the link check, while other hosts are not", () => {
    expect(safeLinkUrl(youtubeSearchUrl("a", "b"))).not.toBeNull();
    expect(safeLinkUrl("https://evil.example.com/x")).toBeNull();
    expect(safeLinkUrl("javascript:alert(1)")).toBeNull();
    // The Apple-only check must NOT accept a YouTube url.
    expect(safeAppleUrl(youtubeSearchUrl("a", "b"))).toBeNull();
  });
});

describe("preferring the real record over a re-recording", () => {
  it("knows a plain title from a re-recording", () => {
    expect(isPlainRecording("O Mere Dil Ke Chain")).toBe(true);
    expect(isPlainRecording('Tum Hi Ho (From "Aashiqui 2")')).toBe(true);
    expect(isPlainRecording("Dekha Ek Khwab - Lofi")).toBe(false);
    expect(isPlainRecording("Ye Shaam Mastani (Amapiano Mix)")).toBe(false);
    expect(isPlainRecording("Chura Liya Hai Tumne (Trap Mix)")).toBe(false);
    expect(isPlainRecording("Dreams - 2004 Remaster")).toBe(false);
  });

  it("picks the original over a remix listed first", () => {
    const hit = findMatch("Ye Shaam Mastani", "Kishore Kumar", [
      { trackName: "Ye Shaam Mastani (Amapiano Mix)", artistName: "Kishore Kumar" },
      { trackName: "Ye Shaam Mastani", artistName: "Kishore Kumar" }
    ]);
    expect(hit?.candidate.trackName).toBe("Ye Shaam Mastani");
  });

  it("prefers the right artist over a plain-titled cover", () => {
    const hit = findMatch("Dreams", "Fleetwood Mac", [
      { trackName: "Dreams", artistName: "Some Cover Band" },
      { trackName: "Dreams", artistName: "Fleetwood Mac" }
    ]);
    expect(hit?.candidate.artistName).toBe("Fleetwood Mac");
    expect(hit?.artistConfirmed).toBe(true);
  });

  it("still takes a remix when it is the only thing that exists", () => {
    const hit = findMatch("Chura Liya Hai Tumne", "Asha Bhosle", [
      { trackName: "Chura Liya Hai Tumne (Trap Mix)", artistName: "Asha Bhosle" }
    ]);
    expect(hit).not.toBeNull();
  });
});
