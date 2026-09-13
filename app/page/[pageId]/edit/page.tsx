import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signUserMedia } from "@/lib/media";
import { AppHeader } from "@/components/app/AppHeader";
import { Icon, type IconName } from "@/components/ui/Icon";
import { PageTitleEditor } from "@/components/composer/PageTitleEditor";
import { SharePanel } from "@/components/composer/SharePanel";
import { ItemBlock, type RenderItem } from "@/components/scrapbook/ItemBlock";
import { CREATION_BY_TYPE } from "@/lib/content-types";
import { moveItem, removeItemFromPage, addItemToPage, deletePage } from "@/app/page/actions";
import type { ContentItem, ContentType, Coupon, MediaAsset } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function EditPage({
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  // Items on the page, in order.
  const { data: pageItemsRaw } = await supabase
    .from("page_items")
    .select("id, sort_order, content_items(*)")
    .eq("page_id", pageId)
    .order("sort_order", { ascending: true });

  const pageItems = (pageItemsRaw ?? []) as unknown as {
    id: string;
    sort_order: number;
    content_items: ContentItem;
  }[];

  const onPageContentIds = pageItems.map((pi) => pi.content_items.id);

  // Media + coupons for on-page items.
  const [{ data: mediaRows }, { data: couponRows }] = await Promise.all([
    onPageContentIds.length
      ? supabase.from("media_assets").select("*").in("content_item_id", onPageContentIds)
      : Promise.resolve({ data: [] as MediaAsset[] }),
    onPageContentIds.length
      ? supabase.from("coupons").select("*").in("content_item_id", onPageContentIds)
      : Promise.resolve({ data: [] as Coupon[] })
  ]);

  const media = (mediaRows ?? []) as MediaAsset[];
  const coupons = (couponRows ?? []) as Coupon[];
  const signed = await signUserMedia(
    supabase.storage,
    media.map((m) => m.storage_path)
  );

  const renderItems: RenderItem[] = pageItems.map((pi) => {
    const ci = pi.content_items;
    const itemMedia = media
      .filter((m) => m.content_item_id === ci.id)
      .map((m) => ({
        url: signed[m.storage_path] || "",
        media_type: m.media_type,
        mime: m.mime_type
      }));
    const coupon = coupons.find((c) => c.content_item_id === ci.id) ?? null;
    return {
      id: ci.id,
      type: ci.type,
      title: ci.title,
      payload: ci.payload_json,
      media: itemMedia,
      coupon: coupon
        ? {
            id: coupon.id,
            coupon_text: coupon.coupon_text,
            expires_at: coupon.expires_at,
            redeemed_at: coupon.redeemed_at
          }
        : null
    };
  });

  // Library: owner's items not yet on this page.
  const { data: libraryRaw } = await supabase
    .from("content_items")
    .select("id, type, title")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });
  const library = ((libraryRaw ?? []) as { id: string; type: ContentType; title: string }[]).filter(
    (i) => !onPageContentIds.includes(i.id)
  );

  return (
    <div className="site-shell">
      <AppHeader name={profile?.display_name} />

      <section className="section page-layout">
        {/* Sidebar */}
        <aside className="sidebar composer-sidebar">
          <Link href="/dashboard" className="back-link">
            <Icon name="ArrowLeft" size={16} /> Dashboard
          </Link>

          <PageTitleEditor pageId={pageId} initialTitle={page.title} />

          <Link href={`/page/${pageId}/preview`} className="button button-light">
            <Icon name="Eye" size={16} /> Preview
          </Link>

          <SharePanel pageId={pageId} initiallyPublished={page.status === "published"} />

          <form action={deletePage.bind(null, pageId)}>
            <button type="submit" className="button button-light delete-page">
              <Icon name="Trash2" size={16} /> Delete page
            </button>
          </form>
        </aside>

        {/* Canvas */}
        <div className="gift-frame">
          <div className="gift-header">
            <h3>{page.title}</h3>
            <span style={{ color: "var(--mauve)" }}>{renderItems.length} little things</span>
          </div>

          {renderItems.length === 0 ? (
            <p className="empty-line">
              Your little corner for them starts here. Add one thing from your
              library below. ♡
            </p>
          ) : (
            <div className="composer-items">
              {renderItems.map((item, idx) => {
                const pi = pageItems[idx];
                return (
                  <div key={pi.id} className="composer-item">
                    <div className="composer-item-controls">
                      <form action={moveItem.bind(null, pageId, pi.id, "up")}>
                        <button
                          type="submit"
                          className="icon-button"
                          aria-label="Move up"
                          disabled={idx === 0}
                        >
                          ↑
                        </button>
                      </form>
                      <form action={moveItem.bind(null, pageId, pi.id, "down")}>
                        <button
                          type="submit"
                          className="icon-button"
                          aria-label="Move down"
                          disabled={idx === renderItems.length - 1}
                        >
                          ↓
                        </button>
                      </form>
                      <form action={removeItemFromPage.bind(null, pageId, pi.id)}>
                        <button type="submit" className="icon-button" aria-label="Remove from page">
                          <Icon name="Trash2" size={15} />
                        </button>
                      </form>
                    </div>
                    <ItemBlock item={item} />
                  </div>
                );
              })}
            </div>
          )}

          {/* Add from library */}
          <div className="library-add">
            <h3 style={{ marginTop: 24 }}>Add from your little things</h3>
            {library.length === 0 ? (
              <p className="empty-line">
                Nothing left to add.{" "}
                <Link href="/dashboard" className="inline-link">
                  Make something new →
                </Link>
              </p>
            ) : (
              <ul className="item-list">
                {library.map((i) => (
                  <li key={i.id} className="library-item">
                    <span className="library-icon">
                      <Icon
                        name={(CREATION_BY_TYPE[i.type]?.icon as IconName) ?? "Heart"}
                        size={16}
                      />
                    </span>
                    <span className="library-body">
                      <strong>{i.title}</strong>
                      <small>{CREATION_BY_TYPE[i.type]?.label ?? i.type}</small>
                    </span>
                    <form action={addItemToPage.bind(null, pageId, i.id)}>
                      <button type="submit" className="button button-plum">
                        <Icon name="Plus" size={15} /> Add
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
