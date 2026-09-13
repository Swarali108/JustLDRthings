import {
  StickyNote,
  Mail,
  Music,
  Ticket,
  Image as ImageIcon,
  Mic,
  Pencil,
  Flower2,
  LayoutGrid,
  Heart,
  Plus,
  ArrowLeft,
  Copy,
  Eye,
  Trash2,
  Share2,
  Check,
  type LucideProps
} from "lucide-react";

const MAP = {
  StickyNote,
  Mail,
  Music,
  Ticket,
  Image: ImageIcon,
  Mic,
  Pencil,
  Flower2,
  LayoutGrid,
  Heart,
  Plus,
  ArrowLeft,
  Copy,
  Eye,
  Trash2,
  Share2,
  Check
} as const;

export type IconName = keyof typeof MAP;

export function Icon({ name, ...props }: { name: IconName } & LucideProps) {
  const Cmp = MAP[name] ?? Heart;
  return <Cmp aria-hidden {...props} />;
}
