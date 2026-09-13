import { CreatorFrame } from "@/components/creators/CreatorFrame";
import { SongCreator } from "@/components/creators/SongCreator";

export default function SongPage() {
  return (
    <CreatorFrame title="Share a song" microcopy="This song made me think of you.">
      <SongCreator />
    </CreatorFrame>
  );
}
