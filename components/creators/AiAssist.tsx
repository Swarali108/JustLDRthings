"use client";

import { useState } from "react";

/**
 * Optional "help me write" button. Calls the server-side AI proxy. If AI is not
 * configured the endpoint returns 503 and we show a gentle message — manual
 * creation is never blocked.
 */
export function AiAssist({
  kind,
  onResult
}: {
  kind: "note" | "letter" | "caption" | "coupon";
  onResult: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function run() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/ai/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, prompt })
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data?.error || "AI help isn't available right now.");
        return;
      }
      if (data?.text) {
        onResult(data.text);
        setOpen(false);
        setPrompt("");
      }
    } catch {
      setMsg("Something went wrong. Write it yourself — you'll do great. ♡");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="ai-chip" onClick={() => setOpen(true)}>
        ✨ Help me write this
      </button>
    );
  }

  return (
    <div className="ai-panel">
      <input
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Optional: what's it about? (e.g. our anniversary)"
        aria-label="AI prompt"
      />
      <div className="row-actions">
        <button type="button" className="button button-plum" onClick={run} disabled={loading}>
          {loading ? "Thinking…" : "Suggest"}
        </button>
        <button type="button" className="button button-light" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {msg ? <p className="form-notice">{msg}</p> : null}
    </div>
  );
}
