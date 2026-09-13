import { CreatorFrame } from "@/components/creators/CreatorFrame";
import { VoiceCreator } from "@/components/creators/VoiceCreator";

export default function VoicePage() {
  return (
    <CreatorFrame title="Record a voice note" microcopy="Let them hear you close.">
      <VoiceCreator />
    </CreatorFrame>
  );
}
