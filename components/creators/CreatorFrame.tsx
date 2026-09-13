import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

/** Shared chrome for a creator screen: back link, title, microcopy. */
export function CreatorFrame({
  title,
  microcopy,
  children
}: {
  title: string;
  microcopy: string;
  children: React.ReactNode;
}) {
  return (
    <section className="section">
      <Link href="/dashboard" className="back-link">
        <Icon name="ArrowLeft" size={16} /> Back to dashboard
      </Link>
      <div className="create-heading" style={{ textAlign: "left", margin: "12px 0 20px" }}>
        <h2>{title}</h2>
        <p className="microcopy" style={{ textAlign: "left", margin: "6px 0 0" }}>
          {microcopy}
        </p>
      </div>
      <div className="studio-layout">{children}</div>
    </section>
  );
}
