import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

/**
 * Shared chrome for a creator screen: back link, title, microcopy.
 *
 * The back link follows the visitor: a guest has no dashboard to return to, and
 * sending them to one would bounce them to /login for no reason.
 */
export function CreatorFrame({
  title,
  microcopy,
  signedIn = true,
  children
}: {
  title: string;
  microcopy: string;
  signedIn?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="section">
      <Link href={signedIn ? "/dashboard" : "/"} className="back-link">
        <Icon name="ArrowLeft" size={16} />{" "}
        {signedIn ? "Back to dashboard" : "Back to home"}
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
