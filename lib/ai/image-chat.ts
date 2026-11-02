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
        // 402 is worth naming rather than folding into a generic failure. It is
        // not a transient error and no retry or restyle will clear it: the
        // account is out of credit, and OpenRouter additionally refuses image
        // output below a $1 balance. Telling the user to "try again" there is
        // advice that cannot work.
        return { error: { message: res.status === 402 ? "billing" : `upstream ${res.status}` } };
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
/** Draws the page. ~$0.04 a call. */
export const IMAGE_MODEL = process.env.COMIC_IMAGE_MODEL || "google/gemini-2.5-flash-image";
