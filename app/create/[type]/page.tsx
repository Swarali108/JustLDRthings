import { notFound } from "next/navigation";
import Link from "next/link";
import { CreatorFrame } from "@/components/creators/CreatorFrame";
import { CREATION_BY_TYPE } from "@/lib/content-types";
import { isSignedIn } from "@/lib/auth";
import type { ContentType } from "@/types/db";

// Catch-all for the P1 canvas creators (doodle, bouquet, collage) that aren't
// built yet. Concrete creators live in their own folders and take priority.
const PLACEHOLDER: ContentType[] = ["doodle", "bouquet", "collage"];

export default async function PlaceholderCreatorPage({
  params
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const signedIn = await isSignedIn();
  if (!PLACEHOLDER.includes(type as ContentType)) notFound();
  const meta = CREATION_BY_TYPE[type as ContentType];

  return (
    <CreatorFrame title={meta.label} microcopy={meta.microcopy} signedIn={signedIn}>
      <div className="studio-panel">
        <p className="eyebrow">Coming soon</p>
        <h3 style={{ marginTop: 8 }}>This one&apos;s still being handmade. ♡</h3>
        <p style={{ lineHeight: 1.6, marginTop: 10 }}>
          The {meta.label.toLowerCase()} studio is a richer canvas experience
          arriving in the next update. For now, your notes, letters, songs,
          coupons, photos and voice notes are ready to go.
        </p>
        <div className="row-actions" style={{ marginTop: 18 }}>
          <Link href={signedIn ? "/dashboard" : "/"} className="button button-plum">
            {signedIn ? "Back to dashboard" : "Back to home"}
          </Link>
        </div>
      </div>
      <div className="studio-panel">
        <p className="eyebrow">Preview</p>
        <div className="paper-preview paper-blue">
          <span className="paper-placeholder">{meta.microcopy}</span>
        </div>
      </div>
    </CreatorFrame>
  );
}
