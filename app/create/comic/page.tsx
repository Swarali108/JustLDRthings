import { CreatorFrame } from "@/components/creators/CreatorFrame";
import { ComicCreator } from "@/components/creators/ComicCreator";
import { isSignedIn } from "@/lib/auth";
import { loadAvatars } from "@/app/create/actions";
import { avatarPairSchema, type AvatarPair } from "@/lib/avatar";

export const dynamic = "force-dynamic";

export default async function ComicPage() {
  const signedIn = await isSignedIn();

  // Signed-in users get the two characters they built last time; guests start
  // from the defaults, since nothing is stored for them.
  const raw = signedIn ? await loadAvatars() : null;
  const parsed = avatarPairSchema.safeParse(raw);
  const savedAvatars: AvatarPair | null = parsed.success ? parsed.data : null;

  return (
    <CreatorFrame
      title="Draw a comic"
      microcopy="Your memory, drawn as a strip."
      signedIn={signedIn}
    >
      <ComicCreator signedIn={signedIn} savedAvatars={savedAvatars} />
    </CreatorFrame>
  );
}
