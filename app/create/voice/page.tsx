import { CreatorFrame } from "@/components/creators/CreatorFrame";
import { VoiceCreator } from "@/components/creators/VoiceCreator";
import { isSignedIn } from "@/lib/auth";

export default async function VoicePage() {
  const signedIn = await isSignedIn();

  return (
    <CreatorFrame
      title="Record a voice note"
      microcopy="Let them hear you close."
      signedIn={signedIn}
    >
      <VoiceCreator signedIn={signedIn} />
    </CreatorFrame>
  );
}
