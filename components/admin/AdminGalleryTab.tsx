"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addGalleryItem, deleteGalleryItem } from "@/lib/actions/admin";
import type { GalleryRow } from "@/lib/supabase/queries";

export function AdminGalleryTab({ gallery }: { gallery: GalleryRow[] }) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await addGalleryItem(formData);
      if (result.error) setError(result.error);
      else {
        setAdding(false);
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => { await deleteGalleryItem(id); });
  }

  return (
    <div className="space-y-4">
      {!adding && (
        <Button size="sm" onClick={() => setAdding(true)}>
          + Add Image
        </Button>
      )}
      {adding && (
        <form onSubmit={handleAdd} className="grid gap-4 rounded-2xl bg-cream p-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="category">Category</Label>
            <Input id="category" name="category" placeholder="e.g. Nails" required />
          </div>
          <div>
            <Label htmlFor="imageUrl">Image URL</Label>
            <Input id="imageUrl" name="imageUrl" type="url" required />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="caption">Caption (optional)</Label>
            <Input id="caption" name="caption" />
          </div>
          {error && <p className="text-sm text-rose-dark sm:col-span-2">{error}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Adding…" : "Add"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {gallery.map((item) => (
          <Card key={item.id} className="overflow-hidden p-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.image_url} alt={item.caption ?? item.category} className="h-36 w-full object-cover" />
            <div className="flex items-center justify-between p-3">
              <div>
                <p className="text-sm font-medium text-ink">{item.caption ?? item.category}</p>
                <p className="text-xs text-ink-soft">{item.category}</p>
              </div>
              <button onClick={() => handleDelete(item.id)} className="text-ink-soft hover:text-rose-dark" aria-label="Delete image">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
