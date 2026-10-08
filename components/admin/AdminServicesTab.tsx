"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { upsertService, toggleServiceActive } from "@/lib/actions/admin";
import type { ServiceRow } from "@/lib/supabase/queries";
import { cn } from "@/lib/utils";

const CATEGORIES = ["Eyelash Extensions", "Lash Lift", "Nails"] as const;

function ServiceForm({ service, onDone }: { service?: ServiceRow; onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await upsertService(formData);
      if (result.error) setError(result.error);
      else onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl bg-cream p-5 sm:grid-cols-2">
      {service && <input type="hidden" name="id" value={service.id} />}
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={service?.name} required />
      </div>
      <div>
        <Label htmlFor="category">Category</Label>
        <Select id="category" name="category" defaultValue={service?.category} required>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="duration">Duration (minutes)</Label>
        <Input id="duration" name="duration" type="number" min={5} defaultValue={service?.duration_minutes} required />
      </div>
      <div>
        <Label htmlFor="price">Price ($)</Label>
        <Input id="price" name="price" type="number" min={0} step="0.01" defaultValue={service?.price} required />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" defaultValue={service?.description ?? ""} />
      </div>
      {error && <p className="text-sm text-rose-dark sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : service ? "Save Changes" : "Add Service"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function AdminServicesTab({ services }: { services: ServiceRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleToggle(id: string, current: boolean) {
    startTransition(async () => { await toggleServiceActive(id, !current); });
  }

  return (
    <div className="space-y-3">
      {!adding && (
        <Button size="sm" onClick={() => setAdding(true)}>
          + Add Service
        </Button>
      )}
      {adding && <ServiceForm onDone={() => setAdding(false)} />}

      {services.map((service) =>
        editingId === service.id ? (
          <ServiceForm key={service.id} service={service} onDone={() => setEditingId(null)} />
        ) : (
          <Card key={service.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="font-display text-base font-semibold text-ink">{service.name}</p>
              <p className="text-sm text-ink-soft">
                {service.category} &middot; {service.duration_minutes} min &middot; ${service.price}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  service.is_active ? "bg-gold/10 text-gold-dark" : "bg-ink/5 text-ink-soft"
                )}
              >
                {service.is_active ? "Active" : "Hidden"}
              </span>
              <Button size="sm" variant="outline" onClick={() => setEditingId(service.id)}>
                Edit
              </Button>
              <Button size="sm" variant="ghost" disabled={isPending} onClick={() => handleToggle(service.id, service.is_active)}>
                {service.is_active ? "Hide" : "Show"}
              </Button>
            </div>
          </Card>
        )
      )}
    </div>
  );
}
