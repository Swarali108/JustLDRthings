import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { renderItemsForOwner } from "@/lib/page-data";
import { ScrapbookPage } from "@/components/scrapbook/ScrapbookPage";
import { Icon } from "@/components/ui/Icon";
import type { ContentItem } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function PreviewPage({
  params
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: page } = await supabase
    .from("pages")
    .select("*")
    .eq("id", pageId)
    .maybeSingle();
  if (!page || page.owner_id !== user.id) notFound();

  const { data: pageItemsRaw } = await supabase
    .from("page_items")
    .select("sort_order, content_items(*)")
    .eq("page_id", pageId)
    .order("sort_order", { ascending: true });

  const ordered = ((pageItemsRaw ?? []) as unknown as { content_items: ContentItem }[]).map(
    (r) => r.content_items
  );
  const items = await renderItemsForOwner(supabase, ordered);

  return (
    <div className="preview-shell">
      <div className="preview-bar">
        <span>Preview — this is exactly what they&apos;ll see.</span>
        <Link href={`/page/${pageId}/edit`} className="button button-light">
          <Icon name="ArrowLeft" size={15} /> Back to editing
        </Link>
      </div>
      <ScrapbookPage title={page.title} items={items} />
    </div>
  );
}
