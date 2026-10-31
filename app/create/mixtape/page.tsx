import { CreatorFrame } from "@/components/creators/CreatorFrame";
import { MixtapeCreator } from "@/components/creators/MixtapeCreator";
import { isSignedIn } from "@/lib/auth";

export default async function MixtapePage() {
  const signedIn = await isSignedIn();

  return (
    <CreatorFrame
      title="Make a mixtape"
      microcopy="Songs picked from your story about them."
      signedIn={signedIn}
    >
      <MixtapeCreator signedIn={signedIn} />
    </CreatorFrame>
  );
}
