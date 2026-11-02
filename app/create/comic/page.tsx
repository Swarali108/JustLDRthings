import { CreatorFrame } from "@/components/creators/CreatorFrame";
import { PhotoComicCreator } from "@/components/creators/PhotoComicCreator";
import { isSignedIn } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ComicPage() {
  const signedIn = await isSignedIn();

  return (
    <CreatorFrame
      title="Make a comic"
      microcopy="Your photos, drawn as a comic."
      signedIn={signedIn}
    >
      <PhotoComicCreator signedIn={signedIn} />
    </CreatorFrame>
  );
}
