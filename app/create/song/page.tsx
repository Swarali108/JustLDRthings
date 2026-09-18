import { CreatorFrame } from "@/components/creators/CreatorFrame";
import { SongCreator } from "@/components/creators/SongCreator";
import { isSignedIn } from "@/lib/auth";

export default async function SongPage() {
  const signedIn = await isSignedIn();

  return (
    <CreatorFrame
      title="Share a song"
      microcopy="This song made me think of you."
      signedIn={signedIn}
    >
      <SongCreator signedIn={signedIn} />
    </CreatorFrame>
  );
}
