"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  upsertStaff, 
  toggleStaffActive, 
  deleteStaffMember, 
  inviteStaffMember 
} from "@/lib/actions/admin";
import type { StaffWithStats } from "@/lib/supabase/queries";
import { cn } from "@/lib/utils";
import { 
  UserCheck, 
  UserX, 
  Mail, 
  Calendar, 
  Trash2, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle,
  Plus
} from "lucide-react";

function StaffForm({ 
  staff, 
  onDone 
}: { 
  staff?: StaffWithStats; 
  onDone: () => void;
}) {
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
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl bg-cream p-5 sm:grid-cols-2 border border-ink/10">
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
        <Textarea id="bio" name="bio" defaultValue={staff?.bio ?? ""} placeholder="Staff experience, specialties, or certifications..." />
      </div>
      {error && <p className="text-sm text-rose-600 sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving..." : staff ? "Save Changes" : "Create Staff Profile"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function InviteStaffForm({ onDone }: { onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await inviteStaffMember(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setMessage(result.message || "Invitation processed successfully!");
        setTimeout(() => {
          onDone();
        }, 2000);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl bg-indigo-50/60 p-6 sm:grid-cols-2 border border-indigo-200">
      <div className="sm:col-span-2 flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold text-indigo-950 flex items-center gap-2">
            <Mail className="h-4 w-4 text-indigo-600" />
            Invite Staff Member via Clerk
          </h3>
          <p className="text-xs text-indigo-800/80 mt-0.5">
            Sends an official Clerk account onboarding email. The recipient will be linked as an authorized staff member upon sign up.
          </p>
        </div>
      </div>

      <div>
        <Label htmlFor="inviteEmail" className="text-indigo-950">Email Address</Label>
        <Input 
          id="inviteEmail" 
          name="email" 
          type="email" 
          placeholder="staff.name@example.com" 
          required 
          className="bg-white border-indigo-200"
        />
      </div>

      <div>
        <Label htmlFor="inviteName" className="text-indigo-950">Full Name</Label>
        <Input 
          id="inviteName" 
          name="fullName" 
          placeholder="e.g. Maria Santos" 
          required 
          className="bg-white border-indigo-200"
        />
      </div>

      <div>
        <Label htmlFor="inviteRole" className="text-indigo-950">Role / Title</Label>
        <Input 
          id="inviteRole" 
          name="roleTitle" 
          defaultValue="Senior Aesthetician" 
          placeholder="e.g. Nail Technician" 
          className="bg-white border-indigo-200"
        />
      </div>

      <div>
        <Label htmlFor="inviteBio" className="text-indigo-950">Bio (Optional)</Label>
        <Input 
          id="inviteBio" 
          name="bio" 
          placeholder="Specialties, certifications..." 
          className="bg-white border-indigo-200"
        />
      </div>

      {error && <p className="text-sm font-medium text-rose-600 sm:col-span-2">{error}</p>}
      {message && <p className="text-sm font-medium text-emerald-700 sm:col-span-2">{message}</p>}

      <div className="flex gap-2 sm:col-span-2 mt-2">
        <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" disabled={isPending}>
          {isPending ? "Sending Clerk Invitation..." : "Send Secure Invitation"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function AdminStaffTab({ staff }: { staff: StaffWithStats[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggle(id: string, current: boolean) {
    setActionFeedback(null);
    startTransition(async () => {
      const res = await toggleStaffActive(id, !current);
      if (res.error) {
        setActionFeedback({ type: "error", text: res.error });
      } else {
        setActionFeedback({ type: "success", text: "Staff status updated." });
      }
    });
  }

  function handleDelete(id: string, name: string) {
    setActionFeedback(null);
    startTransition(async () => {
      const res = await deleteStaffMember(id);
      setDeletingId(null);
      if (res.error) {
        setActionFeedback({ type: "error", text: res.error });
      } else {
        setActionFeedback({ type: "success", text: res.message || `Staff member ${name} was safely removed.` });
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">Staff Management & Profiles</h2>
          <p className="text-xs text-ink-soft">
            Manage team profiles, active status, assignments, and onboarding invitations.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!inviting && !adding && (
            <>
              <Button size="sm" variant="outline" onClick={() => { setInviting(true); setAdding(false); }}>
                <Mail className="mr-1.5 h-4 w-4 text-indigo-600" />
                Invite via Clerk
              </Button>
              <Button size="sm" onClick={() => { setAdding(true); setInviting(false); }}>
                <Plus className="mr-1.5 h-4 w-4" />
                Add Profile
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Global Action Feedback Alert */}
      {actionFeedback && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-xl p-4 text-sm font-medium border",
            actionFeedback.type === "success" 
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          )}
        >
          {actionFeedback.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          )}
          <span>{actionFeedback.text}</span>
        </div>
      )}

      {/* Forms */}
      {adding && <StaffForm onDone={() => setAdding(false)} />}
      {inviting && <InviteStaffForm onDone={() => setInviting(false)} />}

      {/* Staff Cards List */}
      <div className="space-y-4">
        {staff.length === 0 ? (
          <Card className="p-8 text-center text-ink-soft">
            No staff members found. Add or invite a staff member to get started.
          </Card>
        ) : (
          staff.map((member) =>
            editingId === member.id ? (
              <StaffForm key={member.id} staff={member} onDone={() => setEditingId(null)} />
            ) : (
              <Card key={member.id} className="p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2.5">
                    <p className="font-display text-base font-semibold text-ink">{member.full_name}</p>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        member.is_active ? "bg-emerald-100 text-emerald-800" : "bg-ink/10 text-ink-soft"
                      )}
                    >
                      {member.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  {member.role_title && (
                    <p className="text-xs font-medium text-gold-dark">{member.role_title}</p>
                  )}

                  {member.bio && (
                    <p className="text-xs text-ink-soft line-clamp-2 max-w-xl">{member.bio}</p>
                  )}

                  {/* Account linking & appointment metrics */}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink-soft">
                    {/* Clerk Account Status */}
                    <div className="flex items-center gap-1.5">
                      {member.user_id ? (
                        <span className="flex items-center gap-1 text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <UserCheck className="h-3.5 w-3.5" />
                          Linked: {member.user_email || "Clerk ID active"}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          <UserX className="h-3.5 w-3.5" />
                          Not linked to Clerk account
                        </span>
                      )}
                    </div>

                    {/* Workload / Booking Counts */}
                    <div className="flex items-center gap-1 bg-ink/5 px-2 py-0.5 rounded-md">
                      <Calendar className="h-3.5 w-3.5 text-ink-soft" />
                      <span>
                        <strong className="text-ink">{member.upcoming_count}</strong> active upcoming &middot; {member.assigned_count} total
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 sm:items-end">
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-8 text-xs"
                      onClick={() => setEditingId(member.id)}
                    >
                      Edit
                    </Button>

                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-8 text-xs"
                      disabled={isPending} 
                      onClick={() => handleToggle(member.id, member.is_active)}
                    >
                      {member.is_active ? "Deactivate" : "Activate"}
                    </Button>

                    {deletingId !== member.id ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        onClick={() => setDeletingId(member.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Delete
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1 bg-rose-50 p-1 rounded-lg border border-rose-200">
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-rose-600 hover:bg-rose-700 text-white"
                          disabled={isPending}
                          onClick={() => handleDelete(member.id, member.full_name)}
                        >
                          Confirm Delete
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => setDeletingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>

                  {deletingId === member.id && (
                    <div className="max-w-xs text-right text-[11px] text-ink-soft flex items-center gap-1">
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span>
                        {member.upcoming_count > 0 
                          ? `Blocked: Member has ${member.upcoming_count} upcoming bookings.`
                          : "Past appointments will be safely unlinked."
                        }
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            )
          )
        )}
      </div>
    </div>
  );
}
