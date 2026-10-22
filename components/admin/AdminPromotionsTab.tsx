"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { upsertPromotion, togglePromotionActive } from "@/lib/actions/admin";
import type { PromotionRow } from "@/lib/supabase/queries";
import { cn } from "@/lib/utils";

function PromotionForm({ promotion, onDone }: { promotion?: PromotionRow; onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await upsertPromotion(formData);
      if (result.error) setError(result.error);
      else onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl bg-cream p-5 sm:grid-cols-2">
      {promotion && <input type="hidden" name="id" value={promotion.id} />}
      <div>
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" defaultValue={promotion?.title} required />
      </div>
      <div>
        <Label htmlFor="discountCode">Discount code</Label>
        <Input id="discountCode" name="discountCode" defaultValue={promotion?.discount_code ?? ""} />
      </div>
      <div>
        <Label htmlFor="discountPercent">Discount %</Label>
        <Input id="discountPercent" name="discountPercent" type="number" min={0} max={100} defaultValue={promotion?.discount_percent ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" defaultValue={promotion?.description ?? ""} />
      </div>
      {error && <p className="text-sm text-rose-dark sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : promotion ? "Save Changes" : "Add Promotion"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function AdminPromotionsTab({ promotions }: { promotions: PromotionRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleToggle(id: string, current: boolean) {
    startTransition(async () => { await togglePromotionActive(id, !current); });
  }

  return (
    <div className="space-y-3">
      {!adding && (
        <Button size="sm" onClick={() => setAdding(true)}>
          + Add Promotion
        </Button>
      )}
      {adding && <PromotionForm onDone={() => setAdding(false)} />}

      {promotions.map((promo) =>
        editingId === promo.id ? (
          <PromotionForm key={promo.id} promotion={promo} onDone={() => setEditingId(null)} />
        ) : (
          <Card key={promo.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="font-display text-base font-semibold text-ink">{promo.title}</p>
              <p className="text-sm text-ink-soft">
                {promo.discount_code ? `Code: ${promo.discount_code}` : "No code"}
                {promo.discount_percent ? ` · ${promo.discount_percent}% off` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  promo.is_active ? "bg-gold/10 text-gold-dark" : "bg-ink/5 text-ink-soft"
                )}
              >
                {promo.is_active ? "Active" : "Inactive"}
              </span>
              <Button size="sm" variant="outline" onClick={() => setEditingId(promo.id)}>
                Edit
              </Button>
              <Button size="sm" variant="ghost" disabled={isPending} onClick={() => handleToggle(promo.id, promo.is_active)}>
                {promo.is_active ? "Deactivate" : "Activate"}
              </Button>
            </div>
          </Card>
        )
      )}
    </div>
  );
}
