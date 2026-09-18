import { CreatorFrame } from "@/components/creators/CreatorFrame";
import { PaperCreator } from "@/components/creators/PaperCreator";
import { isSignedIn } from "@/lib/auth";

export default async function LetterPage() {
  const signedIn = await isSignedIn();

  return (
    <CreatorFrame
      title="Write a letter"
      microcopy="For everything too big for a text."
      signedIn={signedIn}
    >
      <PaperCreator kind="letter" signedIn={signedIn} />
    </CreatorFrame>
  );
}
