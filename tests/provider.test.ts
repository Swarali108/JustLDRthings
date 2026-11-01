import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveProvider } from "@/lib/ai/provider";

/**
 * The bug this prevents: an OpenRouter key being sent to api.openai.com, which
 * answers 401 and surfaces to the user as a generic "had trouble just then".
 */
describe("resolveProvider", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_MODEL;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("sends an OpenRouter key to OpenRouter, not OpenAI", () => {
    const p = resolveProvider("sk-or-v1-abc123");
    expect(p.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(p.url).not.toContain("api.openai.com");
  });

  it("namespaces the model for OpenRouter", () => {
    expect(resolveProvider("sk-or-v1-abc").model).toBe("openai/gpt-4o-mini");
  });

  it("leaves an OpenAI key pointed at OpenAI, unqualified", () => {
    const p = resolveProvider("sk-proj-abc123");
    expect(p.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(p.model).toBe("gpt-4o-mini");
  });

  it("does not double-namespace a model that already has a slash", () => {
    process.env.OPENAI_MODEL = "anthropic/claude-3-haiku";
    expect(resolveProvider("sk-or-v1-abc").model).toBe("anthropic/claude-3-haiku");
  });

  it("lets an explicit base url win over the key prefix", () => {
    process.env.OPENAI_BASE_URL = "https://openrouter.ai/api/v1";
    const p = resolveProvider("sk-proj-abc"); // an OpenAI-looking key
    expect(p.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(p.model).toBe("openai/gpt-4o-mini"); // treated as OpenRouter
  });

  it("tolerates a trailing slash on the configured base", () => {
    process.env.OPENAI_BASE_URL = "https://api.openai.com/v1/";
    expect(resolveProvider("sk-proj-abc").url).toBe("https://api.openai.com/v1/chat/completions");
  });

  it("always carries the key, and identifies itself to OpenRouter", () => {
    const p = resolveProvider("sk-or-v1-abc");
    expect(p.headers.Authorization).toBe("Bearer sk-or-v1-abc");
    expect(p.headers["X-Title"]).toBe("JustLDRthings");
    expect(resolveProvider("sk-proj-abc").headers["X-Title"]).toBeUndefined();
  });
});
