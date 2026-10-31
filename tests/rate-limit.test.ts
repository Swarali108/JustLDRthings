import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, resetRateLimits, LIMITS, tierFor } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to the limit, then refuses", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("u1", 3, 60_000, now).ok).toBe(true);
    }
    const blocked = rateLimit("u1", 3, 60_000, now);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("keeps users apart", () => {
    const now = 1_000_000;
    rateLimit("u1", 1, 60_000, now);
    expect(rateLimit("u1", 1, 60_000, now).ok).toBe(false);
    expect(rateLimit("u2", 1, 60_000, now).ok).toBe(true);
  });

  it("lets requests through again once the window has passed", () => {
    const now = 1_000_000;
    rateLimit("u1", 1, 60_000, now);
    expect(rateLimit("u1", 1, 60_000, now + 59_000).ok).toBe(false);
    expect(rateLimit("u1", 1, 60_000, now + 61_000).ok).toBe(true);
  });

  it("slides rather than resetting on a fixed boundary", () => {
    const now = 1_000_000;
    rateLimit("u1", 2, 10_000, now);
    rateLimit("u1", 2, 10_000, now + 5_000);
    // The first has aged out by now; the second has not.
    expect(rateLimit("u1", 2, 10_000, now + 11_000).ok).toBe(true);
    expect(rateLimit("u1", 2, 10_000, now + 11_000).ok).toBe(false);
  });
});

describe("tierFor", () => {
  it("gives guests a tighter allowance than signed-in users", () => {
    const guest = tierFor(LIMITS.mixtape, false);
    const member = tierFor(LIMITS.mixtape, true);

    // Fewer runs, over a longer window: an IP bucket is shared and evadable,
    // so the guest allowance is deliberately small.
    expect(guest.limit).toBeLessThan(member.limit);
    expect(guest.windowMs).toBeGreaterThan(member.windowMs);
  });

  it("applies to the writing helper too", () => {
    expect(tierFor(LIMITS.aiWrite, false).limit).toBeLessThan(
      tierFor(LIMITS.aiWrite, true).limit
    );
  });
});

describe("guest buckets", () => {
  beforeEach(() => resetRateLimits());

  it("keeps two guest IPs apart", () => {
    const now = 1_000_000;
    const { limit, windowMs } = tierFor(LIMITS.mixtape, false);

    for (let i = 0; i < limit; i++) {
      expect(rateLimit("mixtape:ip:1.2.3.4", limit, windowMs, now).ok).toBe(true);
    }
    expect(rateLimit("mixtape:ip:1.2.3.4", limit, windowMs, now).ok).toBe(false);
    // A different visitor is unaffected.
    expect(rateLimit("mixtape:ip:5.6.7.8", limit, windowMs, now).ok).toBe(true);
  });

  it("does not let a guest spend a signed-in user's allowance", () => {
    const now = 1_000_000;
    const guest = tierFor(LIMITS.mixtape, false);
    for (let i = 0; i < guest.limit; i++) {
      rateLimit("mixtape:ip:1.2.3.4", guest.limit, guest.windowMs, now);
    }
    expect(rateLimit("mixtape:ip:1.2.3.4", guest.limit, guest.windowMs, now).ok).toBe(false);

    const member = tierFor(LIMITS.mixtape, true);
    expect(rateLimit("mixtape:u:abc", member.limit, member.windowMs, now).ok).toBe(true);
  });
});
