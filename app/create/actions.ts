"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  noteSchema,
  letterSchema,
  songSchema,
  couponSchema,
  mediaMetaSchema,
  voiceMetaSchema
} from "@/lib/validation";
import type { ContentType, MediaType } from "@/types/db";

export interface CreateState {
  error?: string;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** Local datetime-local string -> ISO, or null. */
function toIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ---- Text creators -------------------------------------------------------

export async function saveNote(_prev: CreateState, formData: FormData): Promise<CreateState> {
  const parsed = noteSchema.safeParse({
    title: formData.get("title") ?? "",
    body: formData.get("body") ?? "",
    paper: formData.get("paper") ?? "cream"
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("content_items").insert({
    owner_id: user.id,
    type: "note" as ContentType,
    title: parsed.data.title || "A little note",
    payload_json: { body: parsed.data.body, paper: parsed.data.paper }
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  redirect("/dashboard?created=note");
}

export async function saveLetter(_prev: CreateState, formData: FormData): Promise<CreateState> {
  const parsed = letterSchema.safeParse({
    title: formData.get("title") ?? "",
    body: formData.get("body") ?? "",
    paper: formData.get("paper") ?? "cream"
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("content_items").insert({
    owner_id: user.id,
    type: "letter" as ContentType,
    title: parsed.data.title || "A letter",
    payload_json: { body: parsed.data.body, paper: parsed.data.paper }
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  redirect("/dashboard?created=letter");
}

export async function saveSong(_prev: CreateState, formData: FormData): Promise<CreateState> {
  const parsed = songSchema.safeParse({
    title: formData.get("title") ?? "",
    url: formData.get("url") ?? "",
    note: formData.get("note") ?? ""
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let provider = "link";
  try {
    provider = new URL(parsed.data.url).hostname.replace(/^www\./, "");
  } catch {
    /* validated already */
  }

  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("content_items").insert({
    owner_id: user.id,
    type: "song" as ContentType,
    title: parsed.data.title || "A song for you",
    payload_json: { url: parsed.data.url, note: parsed.data.note, provider }
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  redirect("/dashboard?created=song");
}

export async function saveCoupon(_prev: CreateState, formData: FormData): Promise<CreateState> {
  const parsed = couponSchema.safeParse({
    title: formData.get("title") ?? "",
    coupon_text: formData.get("coupon_text") ?? "",
    expires_at: formData.get("expires_at") ?? ""
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase, user } = await requireUser();
  const { data: item, error } = await supabase
    .from("content_items")
    .insert({
      owner_id: user.id,
      type: "coupon" as ContentType,
      title: parsed.data.title || "A love coupon",
      payload_json: {}
    })
    .select("id")
    .single();
  if (error || !item) return { error: error?.message || "Could not save coupon." };

  const { error: couponError } = await supabase.from("coupons").insert({
    content_item_id: item.id,
    coupon_text: parsed.data.coupon_text,
    expires_at: toIso(parsed.data.expires_at)
  });
  if (couponError) {
    await supabase.from("content_items").delete().eq("id", item.id);
    return { error: couponError.message };
  }
  revalidatePath("/dashboard");
  redirect("/dashboard?created=coupon");
}

// ---- Media / voice (multi-step: client uploads between these calls) -------

export interface DraftResult {
  ok: boolean;
  id?: string;
  error?: string;
}

/** Step 1: create the empty content item so we have an id to key storage on. */
export async function createMediaDraft(
  type: "media" | "voice",
  title: string,
  extra: Record<string, unknown>
): Promise<DraftResult> {
  const schema = type === "voice" ? voiceMetaSchema : mediaMetaSchema;
  const parsed = schema.safeParse({ title, ...extra });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { supabase, user } = await requireUser();
  const fallback = type === "voice" ? "A voice note" : "A little moment";
  const { data, error } = await supabase
    .from("content_items")
    .insert({
      owner_id: user.id,
      type: type as ContentType,
      title: parsed.data.title || fallback,
      payload_json: extra
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message || "Could not start upload." };
  return { ok: true, id: data.id };
}

/** Step 3: record the uploaded object as a media_asset. */
export async function attachMedia(
  itemId: string,
  storagePath: string,
  mediaType: MediaType,
  mimeType: string,
  sizeBytes: number
): Promise<DraftResult> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("media_assets").insert({
    owner_id: user.id,
    content_item_id: itemId,
    storage_path: storagePath,
    media_type: mediaType,
    mime_type: mimeType,
    size_bytes: sizeBytes
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true, id: itemId };
}

/** Rollback a draft if the upload fails client-side. */
export async function discardDraft(itemId: string): Promise<void> {
  const { supabase } = await requireUser();
  await supabase.from("content_items").delete().eq("id", itemId);
}

// ---- Shared item management ----------------------------------------------

export async function deleteContentItem(id: string): Promise<void> {
  const { supabase } = await requireUser();
  await supabase.from("content_items").delete().eq("id", id);
  revalidatePath("/dashboard");
}
