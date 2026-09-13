import { CreatorFrame } from "@/components/creators/CreatorFrame";
import { PaperCreator } from "@/components/creators/PaperCreator";

export default function LetterPage() {
  return (
    <CreatorFrame title="Write a letter" microcopy="For everything too big for a text.">
      <PaperCreator kind="letter" />
    </CreatorFrame>
  );
}
