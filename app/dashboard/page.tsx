import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app/AppHeader";
import { CreatedToast } from "@/components/app/Toast";
import { Icon, type IconName } from "@/components/ui/Icon";
import { VISIBLE_CREATIONS, CREATION_BY_TYPE } from "@/lib/content-types";
import { createPage } from "@/app/page/actions";
import { deleteContentItem } from "@/app/create/actions";
import type { ContentItem, Page } from "@/types/db";

export const dynamic = "force-dynamic";

function itemSummary(item: ContentItem): string {
  const p = item.payload_json as Record<string, string>;
  if (item.type === "song") return p.provider ? `Song · ${p.provider}` : "Song";
  if (item.type === "note" || item.type === "letter") return p.body?.slice(0, 60) || "";
  if (item.type === "media") return p.caption || "Photo / video";
  if (item.type === "voice") return "Voice note";
  if (item.type === "coupon") return "A promise to cash in";
  return CREATION_BY_TYPE[item.type]?.label ?? item.type;
}

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { created } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: items }, { data: pages }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("content_items")
      .select("*")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("pages")
      .select("*")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false })
  ]);

  const contentItems = (items ?? []) as ContentItem[];
  const userPages = (pages ?? []) as Page[];

  return (
    <div className="site-shell">
      <AppHeader name={profile?.display_name} />

      {created ? <CreatedToast label={created} /> : null}

      <section className="section blue-band">
        <div className="create-heading">
          <p className="eyebrow">Your creation hub</p>
          <h2>What will you create today? ♡</h2>
        </div>
        <div className="creation-grid">
          {VISIBLE_CREATIONS.map((c) => (
            <Link
              key={c.type}
              href={c.href}
              className="creation-card"
              aria-label={`${c.label} — ${c.microcopy}`}
            >
              <Icon name={c.icon as IconName} size={26} />
              <strong>{c.label}</strong>
              <span style={{ fontSize: "0.82rem", color: "var(--mauve)" }}>
                {c.ready ? c.microcopy : "Coming soon"}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section split">
        {/* Little things (content library) */}
        <div className="studio-panel">
          <div className="gift-header">
            <h3>Your little things</h3>
            <span style={{ color: "var(--mauve)" }}>{contentItems.length}</span>
          </div>
          {contentItems.length === 0 ? (
            <p className="empty-line">
              Nothing yet. Pick something above to make your first little thing. ♡
            </p>
          ) : (
            <ul className="item-list">
              {contentItems.map((item) => (
                <li key={item.id} className="library-item">
                  <span className="library-icon">
                    <Icon
                      name={(CREATION_BY_TYPE[item.type]?.icon as IconName) ?? "Heart"}
                      size={18}
                    />
                  </span>
                  <span className="library-body">
                    <strong>{item.title}</strong>
                    <small>{itemSummary(item)}</small>
                  </span>
                  <form action={deleteContentItem.bind(null, item.id)}>
                    <button type="submit" className="icon-button" aria-label="Delete">
                      <Icon name="Trash2" size={16} />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pages */}
        <div className="studio-panel">
          <div className="gift-header">
            <h3>Your pages</h3>
            <form action={createPage}>
              <button type="submit" className="button button-plum">
                <Icon name="Plus" size={16} /> New page
              </button>
            </form>
          </div>
          {userPages.length === 0 ? (
            <p className="empty-line">
              Your little corner for them starts here. Make a page, then add your
              things. ♡
            </p>
          ) : (
            <ul className="item-list">
              {userPages.map((page) => (
                <li key={page.id} className="library-item">
                  <span className="library-body">
                    <strong>{page.title}</strong>
                    <small>
                      {page.status === "published" ? "Shared ♡" : "Draft"} ·{" "}
                      {new Date(page.updated_at).toLocaleDateString()}
                    </small>
                  </span>
                  <Link href={`/page/${page.id}/edit`} className="button button-light">
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
