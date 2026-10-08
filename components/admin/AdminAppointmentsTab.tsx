"use client";

import { useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { updateAppointmentStatus } from "@/lib/actions/admin";
import type { AppointmentWithDetails } from "@/lib/supabase/queries";
import type { AppointmentStatus } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

function statusStyles(status: string) {
  if (status === "cancelled") return "bg-ink/5 text-ink-soft";
  if (status === "completed") return "bg-gold/10 text-gold-dark";
  return "bg-rose/20 text-rose-dark";
}

export function AdminAppointmentsTab({ appointments }: { appointments: AppointmentWithDetails[] }) {
  const [isPending, startTransition] = useTransition();

  function handleStatusChange(id: string, status: AppointmentStatus) {
    startTransition(async () => { await updateAppointmentStatus(id, status); });
  }

  if (appointments.length === 0) {
    return <Card className="p-8 text-center text-ink-soft">No appointments yet.</Card>;
  }

  return (
    <div className="space-y-3">
      {appointments.map((appt) => (
        <Card key={appt.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="font-display text-base font-semibold text-ink">{appt.full_name}</p>
            <p className="text-sm text-ink-soft">
              {appt.services?.name ?? "Service"} &middot;{" "}
              {new Date(`${appt.appointment_date}T00:00:00`).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}{" "}
              at {appt.appointment_time}
              {appt.staff?.full_name ? ` · ${appt.staff.full_name}` : ""}
            </p>
            <p className="text-xs text-ink-soft">{appt.email} &middot; {appt.phone}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn("rounded-full px-3 py-1 text-xs font-semibold capitalize", statusStyles(appt.status))}>
              {appt.status}
            </span>
            <Select
              className="h-9 w-36 text-xs"
              defaultValue={appt.status}
              disabled={isPending}
              onChange={(e) => handleStatusChange(appt.id, e.target.value as AppointmentStatus)}
            >
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </div>
        </Card>
      ))}
    </div>
  );
}
