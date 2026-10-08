import { Eye, Sparkles, Gem, type LucideIcon } from "lucide-react";
import type { ServiceCategory } from "@/lib/supabase/types";

export const CATEGORY_ICONS: Record<ServiceCategory, LucideIcon> = {
  "Eyelash Extensions": Eye,
  "Lash Lift": Sparkles,
  Nails: Gem,
};

export function iconForCategory(category: string): LucideIcon {
  return CATEGORY_ICONS[category as ServiceCategory] ?? Sparkles;
}

export function formatServiceForCard(service: { name: string; description: string | null; duration_minutes: number; price: number }) {
  return {
    title: service.name,
    description: service.description,
    duration: `${service.duration_minutes} min`,
    price: `From $${Number(service.price).toFixed(0)}`,
  };
}
