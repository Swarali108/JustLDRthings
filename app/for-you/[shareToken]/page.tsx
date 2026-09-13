import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/share";
import { signUserMedia } from "@/lib/media";
import { ScrapbookPage } from "@/components/scrapbook/ScrapbookPage";
import type { RenderItem, RenderMedia } from "@/components/scrapbook/ItemBlock";
import type { SharedItem, SharedPage } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function RecipientPage({
  params
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;

  // Resolve the token through the SECURITY DEFINER RPC (granted to anon).
  const supabase = await createClient();
  const { data } = await supabase.rpc("resolve_shared_page", {
    p_token_hash: hashToken(shareToken)
  });

  const shared = data as SharedPage | null;
  if (!shared || !shared.page) {
    return (
      <div className="preview-shell">
        <main className="recipient not-found">
          <p className="script-lg">Hmm ♡</p>
          <h1>This link isn&apos;t available.</h1>
          <p style={{ lineHeight: 1.6 }}>
            It may have been turned off, or the link might be incomplete. Ask your
            person to send it again.
          </p>
          <Link href="/" className="button button-plum" style={{ marginTop: 16 }}>
            About JustLDRthings ♡
          </Link>
        </main>
      </div>
    );
  }

  // Sign the private media with the service-role client (token already validated).
  const items = shared.items ?? [];
  const allPaths = items.flatMap((it: SharedItem) =>
    (it.media ?? []).map((m) => m.storage_path)
  );

  let signed: Record<string, string> = {};
  if (allPaths.length > 0 && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = createAdminClient();
      signed = await signUserMedia(admin.storage, allPaths);
    } catch {
      signed = {};
    }
  }

  const renderItems: RenderItem[] = items.map((it: SharedItem) => {
    const media: RenderMedia[] = (it.media ?? []).map((m) => ({
      url: signed[m.storage_path] || "",
      media_type: m.media_type,
      mime: m.mime_type
    }));
    return {
      id: it.id,
      type: it.type,
      title: it.title,
      payload: it.payload ?? {},
      media,
      coupon: it.coupon ?? null
    };
  });

  return (
    <div className="preview-shell">
      <ScrapbookPage title={shared.page.title} items={renderItems} token={shareToken} />
    </div>
  );
}
