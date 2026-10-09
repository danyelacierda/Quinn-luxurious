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

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { markPaidInCash, confirmPayment } from "@/lib/actions/admin";
import { Banknote, CheckCircle } from "lucide-react";

export function AdminAppointmentsTab({ appointments }: { appointments: AppointmentWithDetails[] }) {
  const [isPending, startTransition] = useTransition();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  function handleStatusChange(id: string, status: AppointmentStatus) {
    startTransition(async () => { await updateAppointmentStatus(id, status); });
  }

  async function handleMarkPaid(id: string) {
    setLoadingAction(`cash-${id}`);
    await markPaidInCash(id);
    setLoadingAction(null);
  }

  async function handleConfirmQR(id: string) {
    setLoadingAction(`qr-${id}`);
    await confirmPayment(id);
    setLoadingAction(null);
  }

  if (appointments.length === 0) {
    return <Card className="p-8 text-center text-ink-soft">No appointments yet.</Card>;
  }

  return (
    <div className="space-y-3">
      {appointments.map((appt) => (
        <Card key={appt.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
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
            
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
              <span className="rounded-md bg-ink/5 px-2 py-0.5 text-ink-soft">
                Payment: {appt.payment_status === "fully_paid" ? "Paid" : (appt.payment_method === "qr_ph" ? "Awaiting payment confirmation" : "Pay at the salon")}
              </span>
              {appt.needs_refund && (
                <span className="rounded-md bg-rose-dark/10 px-2 py-0.5 text-rose-dark">Needs Refund / Review</span>
              )}
            </div>
          </div>
          
          <div className="flex flex-col gap-3 sm:items-end">
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
                <option value="pending_payment">Pending Payment</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </div>
            
            {appt.status === "confirmed" && appt.payment_status !== "fully_paid" && (
              <div className="flex items-center gap-2">
                <Button 
                  variant="default" 
                  size="sm" 
                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => handleMarkPaid(appt.id)}
                  disabled={loadingAction === `cash-${appt.id}`}
                >
                  <Banknote className="mr-1 h-3.5 w-3.5" /> Cash
                </Button>
                {appt.payment_method === "qr_ph" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => handleConfirmQR(appt.id)}
                    disabled={loadingAction === `qr-${appt.id}`}
                  >
                    <CheckCircle className="mr-1 h-3.5 w-3.5" /> Confirm QR
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
