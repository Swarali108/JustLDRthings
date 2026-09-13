import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiWriteSchema } from "@/lib/validation";

const SYSTEM: Record<string, string> = {
  note: "You help write a short, warm, sincere note from one partner to another in a long-distance relationship. 1-3 sentences. Tender, specific, not cheesy. No hashtags or emojis unless natural.",
  letter:
    "You help write a heartfelt love letter for a long-distance partner. 2-4 short paragraphs, warm and personal, never generic or clichéd.",
  caption:
    "You suggest a short, affectionate caption (max 12 words) for a photo a partner is sending to their long-distance love.",
  coupon:
    "You suggest a single sweet, playful 'love coupon' promise (max 14 words), e.g. 'Redeemable for one uninterrupted movie night'."
};

export async function POST(request: Request) {
  // Must be signed in.
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI help isn't set up yet — write it in your own words. ♡" },
      { status: 503 }
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const parsed = aiWriteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const { kind, prompt } = parsed.data;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.8,
        max_tokens: 400,
        messages: [
          { role: "system", content: SYSTEM[kind] },
          {
            role: "user",
            content: prompt
              ? `Context: ${prompt}. Write it now, returning only the text.`
              : "Write it now, returning only the text."
          }
        ]
      })
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "The writing helper is busy. Try again in a moment." },
        { status: 502 }
      );
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return NextResponse.json({ error: "No suggestion came back." }, { status: 502 });
    }
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ error: "Could not reach the writing helper." }, { status: 502 });
  }
}
