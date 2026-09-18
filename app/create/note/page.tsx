import { CreatorFrame } from "@/components/creators/CreatorFrame";
import { PaperCreator } from "@/components/creators/PaperCreator";
import { isSignedIn } from "@/lib/auth";

export default async function NotePage() {
  const signedIn = await isSignedIn();

  return (
    <CreatorFrame
      title="Write a note"
      microcopy="Leave a tiny thought for their day."
      signedIn={signedIn}
    >
      <PaperCreator kind="note" signedIn={signedIn} />
    </CreatorFrame>
  );
}
