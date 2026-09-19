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
}

// Order + copy per the blueprint §8.2.
export const CREATIONS: CreationMeta[] = [
  { type: "note", label: "Note", microcopy: "Leave a tiny thought for their day.", href: "/create/note", icon: "StickyNote", ready: true },
  { type: "letter", label: "Letter", microcopy: "For everything too big for a text.", href: "/create/letter", icon: "Mail", ready: true },
  { type: "song", label: "Song + Note", microcopy: "This song made me think of you.", href: "/create/song", icon: "Music", ready: true },
  { type: "coupon", label: "Love Coupon", microcopy: "A promise they can cash in later.", href: "/create/coupon", icon: "Ticket", ready: true },
  { type: "media", label: "Picture / Video", microcopy: "Send a little piece of your world.", href: "/create/media", icon: "Image", ready: true },
  { type: "voice", label: "Voice Note", microcopy: "Let them hear you close.", href: "/create/voice", icon: "Mic", ready: true },
  { type: "doodle", label: "Doodle", microcopy: "Draw the thing you can't say in words.", href: "/create/doodle", icon: "Pencil", ready: true },
  { type: "bouquet", label: "Bouquet", microcopy: "Pick flowers that feel like them.", href: "/create/bouquet", icon: "Flower2", ready: true },
  { type: "collage", label: "Collage", microcopy: "Put your favorite little moments together.", href: "/create/collage", icon: "LayoutGrid", ready: true }
];

export const CREATION_BY_TYPE: Record<ContentType, CreationMeta> = CREATIONS.reduce(
  (acc, c) => {
    acc[c.type] = c;
    return acc;
  },
  {} as Record<ContentType, CreationMeta>
);
