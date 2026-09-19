import { CreatorFrame } from "@/components/creators/CreatorFrame";
import { BouquetCreator } from "@/components/creators/BouquetCreator";
import { isSignedIn } from "@/lib/auth";

export default async function BouquetPage() {
  const signedIn = await isSignedIn();

  return (
    <CreatorFrame
      title="Make a bouquet"
      microcopy="Pick flowers that feel like them."
      signedIn={signedIn}
    >
      <BouquetCreator signedIn={signedIn} />
    </CreatorFrame>
  );
}
