import { CreatorFrame } from "@/components/creators/CreatorFrame";
import { CouponCreator } from "@/components/creators/CouponCreator";

export default function CouponPage() {
  return (
    <CreatorFrame title="Make a love coupon" microcopy="A promise they can cash in later.">
      <CouponCreator />
    </CreatorFrame>
  );
}
