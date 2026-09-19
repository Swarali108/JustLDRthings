import { CreatorFrame } from "@/components/creators/CreatorFrame";
import { DoodleCreator } from "@/components/creators/DoodleCreator";
import { isSignedIn } from "@/lib/auth";

export default async function DoodlePage() {
  const signedIn = await isSignedIn();

  return (
    <CreatorFrame
      title="Draw a doodle"
      microcopy="Draw the thing you can't say in words."
      signedIn={signedIn}
    >
      <DoodleCreator signedIn={signedIn} />
    </CreatorFrame>
  );
}
