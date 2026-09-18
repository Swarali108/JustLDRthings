import { CreatorFrame } from "@/components/creators/CreatorFrame";
import { MediaCreator } from "@/components/creators/MediaCreator";
import { isSignedIn } from "@/lib/auth";

export default async function MediaPage() {
  const signedIn = await isSignedIn();

  return (
    <CreatorFrame
      title="Add a photo or video"
      microcopy="Send a little piece of your world."
      signedIn={signedIn}
    >
      <MediaCreator signedIn={signedIn} />
    </CreatorFrame>
  );
}
