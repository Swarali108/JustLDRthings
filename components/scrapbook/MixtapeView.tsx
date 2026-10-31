"use client";

import { useEffect, useRef, useState } from "react";
import type { Mixtape } from "@/lib/mixtape";

/**
 * A mixtape as a cassette, with 30-second previews.
 *
 * Client-side because playback is stateful: one `<audio>` element is reused for
 * every track rather than one per track, so starting a new song necessarily
 * stops the last one and two previews can never overlap.
 *
 * Previews are Apple's 30-second clips. A track without one still renders — the
 * store does not supply a preview for everything, and a missing clip is not a
 * reason to hide a song the sender chose.
 */
export function MixtapeView({ mixtape, editable = false, onChange }: {
  mixtape: Mixtape;
  editable?: boolean;
  onChange?: (next: Mixtape) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);

  // Stop the audio if this card goes away mid-play.
  useEffect(() => {
    const el = audioRef.current;
    return () => {
      el?.pause();
    };
  }, []);

  function toggle(index: number, url: string | null) {
    const el = audioRef.current;
    if (!el || !url) return;

    if (playing === index) {
      el.pause();
      setPlaying(null);
      return;
    }

    el.src = url;
    void el.play().then(
      () => setPlaying(index),
      () => setPlaying(null) // autoplay refused, or the clip would not load
    );
  }

  function removeTrack(index: number) {
    if (!onChange) return;
    onChange({ ...mixtape, tracks: mixtape.tracks.filter((_, i) => i !== index) });
  }

  function move(index: number, by: -1 | 1) {
    if (!onChange) return;
    const next = [...mixtape.tracks];
    const to = index + by;
    if (to < 0 || to >= next.length) return;
    [next[index], next[to]] = [next[to], next[index]];
    onChange({ ...mixtape, tracks: next });
  }

  return (
    <div className="mixtape">
      <div className="cassette" aria-hidden>
        <div className="cassette-label">
          <span className="cassette-side">A</span>
          <strong>{mixtape.title}</strong>
        </div>
        <div className="cassette-window">
          <span className={`reel${playing !== null ? " reel-spin" : ""}`} />
          <span className="tape-span" />
          <span className={`reel${playing !== null ? " reel-spin" : ""}`} />
        </div>
        <div className="cassette-screws">
          <i /><i /><i /><i />
        </div>
      </div>

      {mixtape.dedication ? <p className="mixtape-dedication">{mixtape.dedication}</p> : null}

      <ol className="tracklist">
        {mixtape.tracks.map((track, i) => (
          <li key={`${track.title}-${track.artist}-${i}`} className="track">
            <span className="track-art">
              {track.artworkUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={track.artworkUrl} alt="" width={48} height={48} />
              ) : (
                <span className="track-art-blank">♫</span>
              )}
            </span>

            <span className="track-body">
              <strong>{track.title}</strong>
              <small>{track.artist}</small>
              {track.reason ? <em className="track-reason">{track.reason}</em> : null}
            </span>

            <span className="track-actions">
              {track.previewUrl ? (
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => toggle(i, track.previewUrl)}
                  aria-label={playing === i ? `Pause ${track.title}` : `Play 30 seconds of ${track.title}`}
                >
                  {playing === i ? "❚❚" : "▶"}
                </button>
              ) : (
                <span className="track-nopreview" title="No preview available">—</span>
              )}

              {track.appleMusicUrl ? (
                <a
                  href={track.appleMusicUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="icon-button"
                  aria-label={`Open ${track.title} in Apple Music`}
                >
                  ↗
                </a>
              ) : null}

              {editable ? (
                <>
                  <button type="button" className="icon-button" onClick={() => move(i, -1)} aria-label="Move up" disabled={i === 0}>↑</button>
                  <button type="button" className="icon-button" onClick={() => move(i, 1)} aria-label="Move down" disabled={i === mixtape.tracks.length - 1}>↓</button>
                  <button type="button" className="icon-button" onClick={() => removeTrack(i)} aria-label={`Remove ${track.title}`}>✕</button>
                </>
              ) : null}
            </span>
          </li>
        ))}
      </ol>

      <audio ref={audioRef} onEnded={() => setPlaying(null)} preload="none" />
    </div>
  );
}
