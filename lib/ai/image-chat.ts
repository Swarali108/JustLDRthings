import { resolveProvider } from "@/lib/ai/provider";
import type { ChatFn } from "@/lib/ai/mixtape-run";

/**
 * A chat function pinned to a specific model, for the stages that need one.
 *
 * The normal `resolveProvider` picks the configured text model. The comic needs
 * a vision model to read photographs and an image model to draw, neither of
 * which is the app's default — so those two stages name their model here rather
 * than forcing everything else onto it.
 */
export function modelChat(apiKey: string, model: string, timeoutMs: number): ChatFn {
  const provider = resolveProvider(apiKey);
  const isOpenRouter = provider.url.includes("openrouter.ai");

  return async (body) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(provider.url, {
        method: "POST",
        headers: provider.headers,
        // The model from the caller wins over the configured default.
        body: JSON.stringify({ ...body, model: isOpenRouter ? model : body.model }),
        signal: controller.signal
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error(
          JSON.stringify({ at: "ai.image-chat.upstream", model, status: res.status, detail: detail.slice(0, 300) })
        );
        // 402 is worth naming rather than folding into a generic failure. No
        // retry or restyle clears it, and only the operator can act on it.
        //
        // It does NOT necessarily mean the account is out of money. OpenRouter
        // refuses image output unless at least $1 remains in the *key's* own
        // budget, so a key with a $1 cap stops drawing once ~$0.35 is spent
        // while the account still holds credit. The remedy is usually to raise
        // or remove the key's limit, not to buy more credit — so the detail
        // above is logged in full, because it carries that distinction.
        if (res.status === 402) {
          console.error(
            JSON.stringify({
              at: "ai.image-chat.budget",
              hint: "Image output needs >= $1 remaining on the KEY's budget. Check the key's spend limit at openrouter.ai/settings/keys before adding credit."
            })
          );
          return { error: { message: "budget" } };
        }
        return { error: { message: `upstream ${res.status}` } };
      }
      return await res.json();
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      return { error: { message: aborted ? "timeout" : "network" } };
    } finally {
      clearTimeout(timer);
    }
  };
}

/** Reads photographs and writes the script. Cheap and fast. */
export const VISION_MODEL = process.env.COMIC_VISION_MODEL || "google/gemini-2.5-flash";
/**
 * Draws one panel. ~$0.04 a call.
 *
 * Nano Banana 2.1 rather than the 2.5-flash-image it replaced: OpenRouter
 * prices both image outputs identically ($0.00003 a token, so ~$0.039 for a
 * 1024px panel), and the newer model follows instructions more closely — which
 * is the open complaint against the old one, since it kept drawing internal
 * borders and sub-panels it had been told not to draw.
 *
 * Overridable, because this is exactly the sort of choice that dates. The
 * tiers available, per 1024px panel:
 *   gemini-3.1-flash-lite-image  ~$0.039   same price, lite
 *   gemini-nano-banana-2.1       ~$0.039   same price   <- default
 *   gemini-3.1-flash-image       ~$0.077   2x
 *   gemini-3-pro-image           ~$0.155   4x, best quality
 */
export const IMAGE_MODEL = process.env.COMIC_IMAGE_MODEL || "google/gemini-nano-banana-2.1";
