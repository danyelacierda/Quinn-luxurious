import { Eye, Sparkles, Gem, type LucideIcon } from "lucide-react";
import type { ServiceCategory } from "@/lib/supabase/types";
import { formatPHP } from "@/lib/format";
import { imageForService, DEFAULT_CATEGORY_IMAGES } from "@/lib/serviceImages";

export { imageForService, DEFAULT_CATEGORY_IMAGES };

export const CATEGORY_ICONS: Record<ServiceCategory, LucideIcon> = {
  "Eyelash Extensions": Eye,
  "Lash Lift": Sparkles,
  Nails: Gem,
};

export function iconForCategory(category: string): LucideIcon {
  return CATEGORY_ICONS[category as ServiceCategory] ?? Sparkles;
}

export function formatServiceForCard(service: {
  id?: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  category?: string;
  image_url?: string | null;
}) {
  return {
    id: service.id,
    title: service.name,
    description: service.description,
    duration: `${service.duration_minutes} min`,
    price: `From ${formatPHP(service.price)}`,
    category: service.category,
    imageUrl: imageForService(service),
  };
}
