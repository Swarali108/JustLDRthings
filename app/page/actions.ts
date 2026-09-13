"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateShareToken, hashToken, shareUrl } from "@/lib/share";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** Verify the signed-in user owns the page (RLS also enforces this). */
async function assertOwnsPage(pageId: string) {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("pages")
    .select("id, owner_id")
    .eq("id", pageId)
    .single();
  if (!data || data.owner_id !== user.id) redirect("/dashboard");
  return { supabase, user };
}

export async function createPage(): Promise<void> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("pages")
    .insert({ owner_id: user.id, title: "For You" })
    .select("id")
    .single();
  if (error || !data) redirect("/dashboard");
  redirect(`/page/${data!.id}/edit`);
}

export async function updatePageTitle(pageId: string, title: string): Promise<void> {
  const { supabase } = await assertOwnsPage(pageId);
  const clean = title.trim().slice(0, 120) || "For You";
  await supabase.from("pages").update({ title: clean }).eq("id", pageId);
  revalidatePath(`/page/${pageId}/edit`);
}

export async function addItemToPage(pageId: string, contentItemId: string): Promise<void> {
  const { supabase } = await assertOwnsPage(pageId);
  const { data: last } = await supabase
    .from("page_items")
    .select("sort_order")
    .eq("page_id", pageId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (last?.sort_order ?? -1) + 1;
  await supabase
    .from("page_items")
    .insert({ page_id: pageId, content_item_id: contentItemId, sort_order: nextOrder });
  revalidatePath(`/page/${pageId}/edit`);
}

export async function removeItemFromPage(pageId: string, pageItemId: string): Promise<void> {
  const { supabase } = await assertOwnsPage(pageId);
  await supabase.from("page_items").delete().eq("id", pageItemId).eq("page_id", pageId);
  revalidatePath(`/page/${pageId}/edit`);
}

export async function moveItem(
  pageId: string,
  pageItemId: string,
  direction: "up" | "down"
): Promise<void> {
  const { supabase } = await assertOwnsPage(pageId);
  const { data: items } = await supabase
    .from("page_items")
    .select("id, sort_order")
    .eq("page_id", pageId)
    .order("sort_order", { ascending: true });
  if (!items) return;

  const idx = items.findIndex((i) => i.id === pageItemId);
  if (idx === -1) return;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= items.length) return;

  const a = items[idx];
  const b = items[swapIdx];
  await supabase.from("page_items").update({ sort_order: b.sort_order }).eq("id", a.id);
  await supabase.from("page_items").update({ sort_order: a.sort_order }).eq("id", b.id);
  revalidatePath(`/page/${pageId}/edit`);
}

export interface ShareResult {
  ok: boolean;
  url?: string;
  error?: string;
}

/**
 * Publish the page and (re)issue a single share token. Returns the raw token URL
 * exactly once — only its hash is stored.
 */
export async function publishAndShare(pageId: string): Promise<ShareResult> {
  const { supabase } = await assertOwnsPage(pageId);

  const { count } = await supabase
    .from("page_items")
    .select("id", { count: "exact", head: true })
    .eq("page_id", pageId);
  if (!count) {
    return { ok: false, error: "Add at least one little thing before sharing." };
  }

  await supabase.from("pages").update({ status: "published" }).eq("id", pageId);

  // One active share row per page: clear old ones, issue a fresh token.
  await supabase.from("page_shares").delete().eq("page_id", pageId);
  const token = generateShareToken();
  const { error } = await supabase
    .from("page_shares")
    .insert({ page_id: pageId, token_hash: hashToken(token), enabled: true });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/page/${pageId}/edit`);
  return { ok: true, url: shareUrl(token) };
}

export async function disableShare(pageId: string): Promise<ShareResult> {
  const { supabase } = await assertOwnsPage(pageId);
  await supabase.from("page_shares").update({ enabled: false }).eq("page_id", pageId);
  await supabase.from("pages").update({ status: "draft" }).eq("id", pageId);
  revalidatePath(`/page/${pageId}/edit`);
  return { ok: true };
}

export async function deletePage(pageId: string): Promise<void> {
  const { supabase } = await assertOwnsPage(pageId);
  await supabase.from("pages").delete().eq("id", pageId);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
