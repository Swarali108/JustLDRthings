import { CreatorFrame } from "@/components/creators/CreatorFrame";
import { CollageCreator } from "@/components/creators/CollageCreator";
import { isSignedIn } from "@/lib/auth";

export default async function CollagePage() {
  const signedIn = await isSignedIn();

  return (
    <CreatorFrame
      title="Make a collage"
      microcopy="Put your favorite little moments together."
      signedIn={signedIn}
    >
      <CollageCreator signedIn={signedIn} />
    </CreatorFrame>
  );
}
