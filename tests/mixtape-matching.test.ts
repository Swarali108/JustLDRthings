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

  it("requires BOTH title and artist, so a cover is not accepted", () => {
    const hit = findMatch("Cruel Summer", "Taylor Swift", results);
    expect(hit?.artistName).toBe("Taylor Swift");
    expect(hit?.previewUrl).toContain("audio-ssl.itunes.apple.com");
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
