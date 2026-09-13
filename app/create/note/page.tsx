import { CreatorFrame } from "@/components/creators/CreatorFrame";
import { PaperCreator } from "@/components/creators/PaperCreator";

export default function NotePage() {
  return (
    <CreatorFrame title="Write a note" microcopy="Leave a tiny thought for their day.">
      <PaperCreator kind="note" />
    </CreatorFrame>
  );
}
