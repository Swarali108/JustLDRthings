import type { ContentType } from "@/types/db";

export interface CreationMeta {
  type: ContentType;
  label: string;
  microcopy: string;
  href: string;
  /** lucide-react icon name */
  icon: string;
  /** Kept for future unbuilt types; everything listed is currently built. */
  ready: boolean;
  /**
   * Built, but deliberately not offered right now. The creator and its route
   * still exist, so bringing one back is a one-line change rather than a
   * rebuild -- which matters, because these have been toggled before.
   */
  hidden?: boolean;
}

/**
 * The order the pickers show, and the order is deliberate: the things people
 * most want to make come first, and the quick ones sit at the end rather than
 * the front. It is NOT alphabetical, grouped by kind, or in build order — so
 * adding something new means choosing where it belongs, not appending it.
 *
 * Hidden entries stay in the list, in place, because CREATIONS also resolves
 * saved items; removing one would break anything already made with it.
 */
export const CREATIONS: CreationMeta[] = [
  { type: "letter", label: "Letter", microcopy: "For everything too big for a text.", href: "/create/letter", icon: "Mail", ready: true },
  { type: "poem", label: "AI Poem", microcopy: "Built from the things only you two know.", href: "/create/poem", icon: "Feather", ready: true },
  { type: "mixtape", label: "AI Mixtape", microcopy: "Songs picked from your story about them.", href: "/create/mixtape", icon: "Music", ready: true },
  { type: "song", label: "Song + Note", microcopy: "This song made me think of you.", href: "/create/song", icon: "Music", ready: true },
  { type: "comic", label: "AI Comic", microcopy: "Your memory, drawn as a strip.", href: "/create/comic", icon: "LayoutGrid", ready: true },
  { type: "coupon", label: "Love Coupon", microcopy: "A promise they can cash in later.", href: "/create/coupon", icon: "Ticket", ready: true },
  { type: "media", label: "Picture / Video", microcopy: "Send a little piece of your world.", href: "/create/media", icon: "Image", ready: true },
  { type: "voice", label: "Voice Note", microcopy: "Let them hear you close.", href: "/create/voice", icon: "Mic", ready: true },
  { type: "note", label: "Note", microcopy: "Leave a tiny thought for their day.", href: "/create/note", icon: "StickyNote", ready: true },
  { type: "bouquet", label: "Bouquet", microcopy: "Pick flowers that feel like them.", href: "/create/bouquet", icon: "Flower2", ready: true },
  { type: "doodle", label: "Doodle", microcopy: "Draw the thing you can't say in words.", href: "/create/doodle", icon: "Pencil", ready: true, hidden: true },
  { type: "collage", label: "Collage", microcopy: "Put your favorite little moments together.", href: "/create/collage", icon: "LayoutGrid", ready: true, hidden: true }
];

/** What the pickers offer. CREATIONS stays complete so saved items still resolve. */
export const VISIBLE_CREATIONS: CreationMeta[] = CREATIONS.filter((c) => !c.hidden);

export const CREATION_BY_TYPE: Record<ContentType, CreationMeta> = CREATIONS.reduce(
  (acc, c) => {
    acc[c.type] = c;
    return acc;
  },
  {} as Record<ContentType, CreationMeta>
);
