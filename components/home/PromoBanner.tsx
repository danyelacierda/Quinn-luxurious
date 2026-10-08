import { Tag } from "lucide-react";
import { getActivePromotions } from "@/lib/supabase/queries";

export async function PromoBanner() {
  const promotions = await getActivePromotions();
  if (promotions.length === 0) return null;

  const promo = promotions[0];

  return (
    <div className="bg-ink py-3 text-center text-sm text-paper">
      <div className="container flex flex-wrap items-center justify-center gap-2">
        <Tag className="h-4 w-4 text-gold" />
        <span className="font-medium">{promo.title}</span>
        {promo.description && <span className="text-paper/70">— {promo.description}</span>}
        {promo.discount_code && (
          <span className="rounded-full bg-gold/20 px-2.5 py-0.5 font-mono text-xs text-gold">
            {promo.discount_code}
          </span>
        )}
      </div>
    </div>
  );
}
