import { CreatorFrame } from "@/components/creators/CreatorFrame";
import { PoemCreator } from "@/components/creators/PoemCreator";
import { isSignedIn } from "@/lib/auth";

export default async function PoemPage() {
  const signedIn = await isSignedIn();

  return (
    <CreatorFrame
      title="Write a poem"
      microcopy="Built from the things only you two know."
      signedIn={signedIn}
    >
      <PoemCreator signedIn={signedIn} />
    </CreatorFrame>
  );
}
