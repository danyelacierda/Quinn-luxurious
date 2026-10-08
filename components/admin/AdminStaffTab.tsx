"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { upsertStaff, toggleStaffActive } from "@/lib/actions/admin";
import type { StaffRow } from "@/lib/supabase/queries";
import { cn } from "@/lib/utils";

function StaffForm({ staff, onDone }: { staff?: StaffRow; onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await upsertStaff(formData);
      if (result.error) setError(result.error);
      else onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl bg-cream p-5 sm:grid-cols-2">
      {staff && <input type="hidden" name="id" value={staff.id} />}
      <div>
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" defaultValue={staff?.full_name} required />
      </div>
      <div>
        <Label htmlFor="roleTitle">Role / title</Label>
        <Input id="roleTitle" name="roleTitle" defaultValue={staff?.role_title ?? ""} placeholder="e.g. Lead Lash Artist" />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" name="bio" defaultValue={staff?.bio ?? ""} />
      </div>
      {error && <p className="text-sm text-rose-dark sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : staff ? "Save Changes" : "Add Staff Member"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function AdminStaffTab({ staff }: { staff: StaffRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleToggle(id: string, current: boolean) {
    startTransition(async () => { await toggleStaffActive(id, !current); });
  }

  return (
    <div className="space-y-3">
      {!adding && (
        <Button size="sm" onClick={() => setAdding(true)}>
          + Add Staff Member
        </Button>
      )}
      {adding && <StaffForm onDone={() => setAdding(false)} />}

      {staff.map((member) =>
        editingId === member.id ? (
          <StaffForm key={member.id} staff={member} onDone={() => setEditingId(null)} />
        ) : (
          <Card key={member.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="font-display text-base font-semibold text-ink">{member.full_name}</p>
              {member.role_title && <p className="text-sm text-ink-soft">{member.role_title}</p>}
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  member.is_active ? "bg-gold/10 text-gold-dark" : "bg-ink/5 text-ink-soft"
                )}
              >
                {member.is_active ? "Active" : "Inactive"}
              </span>
              <Button size="sm" variant="outline" onClick={() => setEditingId(member.id)}>
                Edit
              </Button>
              <Button size="sm" variant="ghost" disabled={isPending} onClick={() => handleToggle(member.id, member.is_active)}>
                {member.is_active ? "Deactivate" : "Activate"}
              </Button>
            </div>
          </Card>
        )
      )}
    </div>
  );
}
