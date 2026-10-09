"use client";

import { useState, useTransition } from "react";
import { Calendar, Clock, Loader2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cancelAppointment, rescheduleAppointment } from "@/lib/actions/account";
import { fetchAvailableSlots } from "@/lib/actions/booking";
import type { AppointmentWithDetails } from "@/lib/supabase/queries";
import { cn } from "@/lib/utils";

function nextNDays(n: number): Date[] {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}
function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function statusStyles(status: string) {
  if (status === "cancelled") return "bg-ink/5 text-ink-soft";
  if (status === "completed") return "bg-gold/10 text-gold-dark";
  return "bg-rose/20 text-rose-dark";
}

function AppointmentCard({ appt }: { appt: AppointmentWithDetails }) {
  const [isPending, startTransition] = useTransition();
  const [rescheduling, setRescheduling] = useState(false);
  const [dateISO, setDateISO] = useState("");
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const days = nextNDays(21);

  const canModify = appt.status === "confirmed";

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelAppointment(appt.id);
      if (result.error) setError(result.error);
    });
  }

  async function loadSlots(iso: string) {
    setLoadingSlots(true);
    setTime("");
    try {
      const available = await fetchAvailableSlots(iso, appt.staff_id, appt.services?.duration_minutes ?? 60);
      setSlots(available);
    } finally {
      setLoadingSlots(false);
    }
  }

  function handleConfirmReschedule() {
    if (!dateISO || !time) return;
    setError(null);
    startTransition(async () => {
      const result = await rescheduleAppointment(appt.id, dateISO, time);
      if (result.error) {
        setError(result.error);
        return;
      }
      setRescheduling(false);
    });
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-semibold text-ink">{appt.services?.name ?? "Service"}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-ink-soft">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(`${appt.appointment_date}T00:00:00`).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {appt.appointment_time}
            </span>
            {appt.staff?.full_name && <span>with {appt.staff.full_name}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={cn("rounded-full px-3 py-1 text-xs font-semibold capitalize", statusStyles(appt.status))}>
            {appt.status}
          </span>
          <span className="text-xs text-ink-soft">
            Payment: {appt.payment_status === "fully_paid" ? "Paid" : (appt.payment_method === "qr_ph" ? "Awaiting payment confirmation" : "Pay at the salon")}
          </span>
        </div>
      </div>

      {canModify && (
        <div className="mt-4 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setRescheduling((v) => !v);
              setError(null);
            }}
          >
            Reschedule
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancel} disabled={isPending} className="gap-1.5 text-rose-dark">
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            Cancel
          </Button>
        </div>
      )}

      {rescheduling && (
        <div className="mt-5 rounded-2xl bg-cream p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">New date</p>
          <div className="flex gap-2 overflow-x-auto pb-2 ql-scrollbar">
            {days.map((d) => {
              const iso = toISODate(d);
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => {
                    setDateISO(iso);
                    loadSlots(iso);
                  }}
                  className={cn(
                    "flex min-w-[56px] flex-col items-center rounded-xl border px-2.5 py-2 transition-all",
                    dateISO === iso ? "border-gold bg-gold/10" : "border-ink/10 bg-white"
                  )}
                >
                  <span className="text-[10px] uppercase text-ink-soft">
                    {d.toLocaleDateString(undefined, { weekday: "short" })}
                  </span>
                  <span className="font-display text-sm font-semibold text-ink">{d.getDate()}</span>
                </button>
              );
            })}
          </div>

          {dateISO && (
            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">New time</p>
              {loadingSlots ? (
                <Loader2 className="h-4 w-4 animate-spin text-ink-soft" />
              ) : slots.length === 0 ? (
                <p className="text-sm text-ink-soft">No times available that day.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setTime(slot)}
                      className={cn(
                        "rounded-lg border px-2 py-1.5 text-xs font-medium transition-all",
                        time === slot ? "border-gold bg-gold/10 text-gold-dark" : "border-ink/10 bg-white text-ink"
                      )}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <Button size="sm" className="mt-4" disabled={!dateISO || !time || isPending} onClick={handleConfirmReschedule}>
            {isPending ? "Saving…" : "Confirm New Time"}
          </Button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-rose-dark">{error}</p>}
    </Card>
  );
}

export function AppointmentsList({ appointments }: { appointments: AppointmentWithDetails[] }) {
  if (appointments.length === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="text-ink-soft">You don&rsquo;t have any appointments yet.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {appointments.map((appt) => (
        <AppointmentCard key={appt.id} appt={appt} />
      ))}
    </div>
  );
}
