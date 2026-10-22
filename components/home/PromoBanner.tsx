import { getActivePromotions } from "@/lib/supabase/queries";
import { PromoTicker } from "@/components/home/PromoTicker";

export async function PromoBanner() {
  const promotions = await getActivePromotions();
  if (promotions.length === 0) return null;

  return <PromoTicker promotions={promotions} />;
}
