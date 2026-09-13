// Sign private user-media object paths into short-lived URLs. Works with either
// the owner's RLS-scoped client or the service-role admin client (recipient).

interface StorageLike {
  from: (bucket: string) => {
    createSignedUrls: (
      paths: string[],
      expiresIn: number
    ) => Promise<{ data: { path?: string | null; signedUrl?: string | null }[] | null }>;
  };
}

export async function signUserMedia(
  storage: StorageLike,
  paths: string[],
  expiresIn = 3600
): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return {};
  const { data } = await storage.from("user-media").createSignedUrls(unique, expiresIn);
  const map: Record<string, string> = {};
  (data || []).forEach((d) => {
    if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
  });
  return map;
}
