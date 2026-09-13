import { CreatorFrame } from "@/components/creators/CreatorFrame";
import { MediaCreator } from "@/components/creators/MediaCreator";

export default function MediaPage() {
  return (
    <CreatorFrame title="Add a photo or video" microcopy="Send a little piece of your world.">
      <MediaCreator />
    </CreatorFrame>
  );
}
