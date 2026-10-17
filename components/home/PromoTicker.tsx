"use client";

import { useState } from "react";
import { Tag, Check, Copy } from "lucide-react";
import type { PromotionRow } from "@/lib/supabase/queries";

export function PromoTicker({ promotions }: { promotions: PromotionRow[] }) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  if (!promotions || promotions.length === 0) return null;

  function handleCopy(code: string) {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2500);
    }
  }

  const renderPromoItem = (promo: PromotionRow, index: number, isDuplicate = false) => (
    <div
      key={`${promo.id}-${index}-${isDuplicate ? "dup" : "orig"}`}
      className="inline-flex items-center gap-2.5 px-6 shrink-0"
    >
      <Tag className="h-3.5 w-3.5 text-gold-light shrink-0" />
      <span className="font-semibold text-paper tracking-wide text-xs sm:text-sm">
        {promo.title}
      </span>
      {promo.description && (
        <span className="text-paper/75 text-xs hidden md:inline">
          &mdash; {promo.description}
        </span>
      )}
      {promo.discount_code && (
        <button
          type="button"
          onClick={() => handleCopy(promo.discount_code!)}
          title="Click to copy promo code"
          tabIndex={isDuplicate ? -1 : 0}
          className="inline-flex items-center gap-1.5 rounded-full bg-gold/25 hover:bg-gold/40 border border-gold/40 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-gold-light transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold-light"
        >
          <span>{promo.discount_code}</span>
          {copiedCode === promo.discount_code ? (
            <span className="flex items-center gap-1 text-[10px] text-white">
              <Check className="h-3 w-3 stroke-[2.5]" />
              Copied!
            </span>
          ) : (
            <Copy className="h-2.5 w-2.5 opacity-70" />
          )}
        </button>
      )}
      <span className="text-gold/30 px-3">&bull;</span>
    </div>
  );

  return (
    <div
      role="region"
      aria-label="Promotions and Special Offers"
      className="relative h-11 min-h-[44px] w-full overflow-hidden bg-ink text-paper border-b border-gold/15 flex items-center select-none"
    >
      {/* Seamless Continuous Marquee Track */}
      <div className="animate-marquee flex items-center">
        {/* Primary Screen Reader Accessible Track */}
        <div className="flex items-center">
          {promotions.map((p, i) => renderPromoItem(p, i, false))}
        </div>

        {/* Duplicate Track hidden from Screen Readers for continuous infinite loop */}
        <div className="flex items-center" aria-hidden="true">
          {promotions.map((p, i) => renderPromoItem(p, i, true))}
        </div>
      </div>
    </div>
  );
}
