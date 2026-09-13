import { createClient } from "@/lib/supabase/client";
import type { MediaType } from "@/types/db";

export const LIMITS = {
  image: 10 * 1024 * 1024, // 10 MB
  video: 60 * 1024 * 1024, // 60 MB
  audio: 20 * 1024 * 1024 // 20 MB
};

export function mediaTypeForMime(mime: string): MediaType | null {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return null;
}

function safeName(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g, "") : "";
  const base = (dot >= 0 ? name.slice(0, dot) : name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "file"}${ext}`;
}

export async function getUserId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Upload a Blob/File into user-media/<uid>/<itemId>/<filename>. RLS on
 * storage.objects only allows the owner to write under their own uid folder.
 */
export async function uploadToUserMedia(
  file: Blob,
  uid: string,
  itemId: string,
  filename: string
): Promise<{ path?: string; error?: string }> {
  const supabase = createClient();
  const path = `${uid}/${itemId}/${safeName(filename)}`;
  const { error } = await supabase.storage
    .from("user-media")
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) return { error: error.message };
  return { path };
}
