/**
 * Which chat-completions endpoint to call, and under what model name.
 *
 * Both AI routes used to hardcode `api.openai.com`, which quietly broke the
 * moment the key in `.env` was an OpenRouter key (`sk-or-v1-…`): OpenAI replies
 * 401 and the user sees a generic "had trouble just then".
 *
 * Both providers speak the same chat-completions shape, including tool calling,
 * so only the base URL and the model's name differ. Deriving the default from
 * the key's own prefix means a working key works without any extra
 * configuration — a wrong base URL is not a thing anyone should have to
 * diagnose from a 502.
 */

export interface Provider {
  url: string;
  model: string;
  headers: Record<string, string>;
}

const OPENAI_BASE = "https://api.openai.com/v1";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

/** OpenRouter namespaces its models; OpenAI does not. */
function qualifyModel(model: string, isOpenRouter: boolean): string {
  if (!isOpenRouter) return model;
  return model.includes("/") ? model : `openai/${model}`;
}

export function resolveProvider(apiKey: string): Provider {
  // An explicit base always wins; the key prefix is only the default.
  const configured = process.env.OPENAI_BASE_URL?.trim().replace(/\/$/, "");
  const isOpenRouter = configured
    ? configured.includes("openrouter.ai")
    : apiKey.startsWith("sk-or-");

  const base = configured || (isOpenRouter ? OPENROUTER_BASE : OPENAI_BASE);
  const model = qualifyModel(process.env.OPENAI_MODEL || "gpt-4o-mini", isOpenRouter);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`
  };

  // OpenRouter asks callers to identify themselves; it is optional but it is
  // what makes the usage legible on their dashboard.
  if (isOpenRouter) {
    const site = process.env.NEXT_PUBLIC_APP_URL;
    if (site) headers["HTTP-Referer"] = site;
    headers["X-Title"] = "JustLDRthings";
  }

  return { url: `${base}/chat/completions`, model, headers };
}
