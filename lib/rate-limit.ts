/**
 * A per-user sliding-window limiter for the AI routes.
 *
 * Honest about what this is: the counters live in this process's memory. On
 * Vercel that means per serverless instance, so someone hitting several
 * instances at once gets a higher effective limit than the number below
 * suggests. It is a brake on accidental loops and casual abuse — a user holding
 * a key down, a component re-rendering in a cycle — not a billing control.
 *
 * A real limit needs shared state (Upstash, or a Postgres table). That is worth
 * doing when there is a bill to protect; it is not worth the dependency yet.
 * Deliberately recorded rather than implied, so nobody later mistakes this for
 * a guarantee.
 */

interface Window {
  hits: number[];
}

const windows = new Map<string, Window>();

/** Entries older than this are dropped on the next sweep. */
const SWEEP_AFTER_MS = 10 * 60 * 1000;
let lastSweep = Date.now();

function sweep(now: number, windowMs: number) {
  if (now - lastSweep < SWEEP_AFTER_MS) return;
  lastSweep = now;
  for (const [key, win] of windows) {
    const live = win.hits.filter((t) => now - t < windowMs);
    if (live.length === 0) windows.delete(key);
    else win.hits = live;
  }
}

export interface RateLimitResult {
  ok: boolean;
  /** Requests left in the current window. */
  remaining: number;
  /** Seconds until the oldest request falls out of the window. */
  retryAfter: number;
}

/**
 * Record a hit for `key` and say whether it is allowed.
 *
 * `now` is injectable so the tests can move time without sleeping.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): RateLimitResult {
  sweep(now, windowMs);

  const win = windows.get(key) ?? { hits: [] };
  const hits = win.hits.filter((t) => now - t < windowMs);

  if (hits.length >= limit) {
    const oldest = hits[0];
    windows.set(key, { hits });
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000))
    };
  }

  hits.push(now);
  windows.set(key, { hits });
  return { ok: true, remaining: limit - hits.length, retryAfter: 0 };
}

/** Test seam: forget every window. */
export function resetRateLimits(): void {
  windows.clear();
  lastSweep = Date.now();
}

/**
 * Budgets per user.
 *
 * A mixtape run costs a model call plus up to twelve outside lookups, so it is
 * allowed far less often than a one-shot writing suggestion.
 */
export const LIMITS = {
  aiWrite: {
    signedIn: { limit: 20, windowMs: 60_000 },
    guest: { limit: 6, windowMs: 60_000 }
  },
  mixtape: {
    signedIn: { limit: 5, windowMs: 10 * 60_000 },
    guest: { limit: 2, windowMs: 60 * 60_000 }
  },
  // Two model calls, sometimes three with a rewrite, but no outside lookups —
  // so cheaper than a mixtape and allowed more often.
  poem: {
    signedIn: { limit: 10, windowMs: 10 * 60_000 },
    guest: { limit: 4, windowMs: 60 * 60_000 }
  },
  // One model call, occasionally two when a script fails validation. Bigger
  // output than a poem, so a little tighter.
  // Reading photos and writing a script: cheap, so drafts are nearly free and
  // the user can rewrite the story until it is right.
  comicStoryboard: {
    signedIn: { limit: 12, windowMs: 10 * 60_000 },
    guest: { limit: 4, windowMs: 60 * 60_000 }
  },
  // Drawing the page costs about $0.04 each time. This is the tightest limit
  // in the app and it is tight on purpose: it is the only route that spends
  // real money per request, and a guest bucket is an IP, which is weak.
  comicDraw: {
    signedIn: { limit: 4, windowMs: 30 * 60_000 },
    guest: { limit: 2, windowMs: 24 * 60 * 60_000 }
  }
} as const;

/** Pick the tier for a caller. Guests get the tighter one — an IP bucket is
 *  shared and evadable, so it is set low enough that walking past it is not
 *  worth the effort for the value of one mixtape. */
export function tierFor(
  budget: { signedIn: { limit: number; windowMs: number }; guest: { limit: number; windowMs: number } },
  signedIn: boolean
) {
  return signedIn ? budget.signedIn : budget.guest;
}
