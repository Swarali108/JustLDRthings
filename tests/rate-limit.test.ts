import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, resetRateLimits } from "@/lib/rate-limit";

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
