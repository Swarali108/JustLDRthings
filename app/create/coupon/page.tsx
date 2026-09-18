import { CreatorFrame } from "@/components/creators/CreatorFrame";
import { CouponCreator } from "@/components/creators/CouponCreator";
import { isSignedIn } from "@/lib/auth";

export default async function CouponPage() {
  const signedIn = await isSignedIn();

  return (
    <CreatorFrame
      title="Make a love coupon"
      microcopy="A promise they can cash in later."
      signedIn={signedIn}
    >
      <CouponCreator signedIn={signedIn} />
    </CreatorFrame>
  );
}
