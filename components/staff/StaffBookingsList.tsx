"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { markAppointmentCompletedByStaff } from "@/lib/actions/admin";
import type { AppointmentWithDetails, StaffRow } from "@/lib/supabase/queries";
import { cn } from "@/lib/utils";
import { 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  Mail, 
  CheckCircle2, 
  FileText, 
  Check, 
  AlertCircle,
  Sparkles
} from "lucide-react";

type Props = {
  staff: StaffRow;
  appointments: AppointmentWithDetails[];
};

export function StaffBookingsList({ staff, appointments }: Props) {
  const [filter, setFilter] = useState<"all" | "today" | "upcoming" | "completed">("upcoming");
  const [isPending, startTransition] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; type: "success" | "error"; text: string } | null>(null);

  const todayManila = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const todayCount = appointments.filter(
    (a) => a.appointment_date === todayManila && a.status !== "cancelled"
  ).length;

  const upcomingCount = appointments.filter(
    (a) => a.appointment_date >= todayManila && ["confirmed", "pending", "pending_payment"].includes(a.status)
  ).length;

  const completedCount = appointments.filter((a) => a.status === "completed").length;

  const filtered = appointments.filter((a) => {
    if (filter === "today") return a.appointment_date === todayManila && a.status !== "cancelled";
    if (filter === "upcoming") {
      return a.appointment_date >= todayManila && ["confirmed", "pending", "pending_payment"].includes(a.status);
    }
    if (filter === "completed") return a.status === "completed";
    return true;
  });

  function handleComplete(id: string) {
    setLoadingId(id);
    setFeedback(null);
    startTransition(async () => {
      const res = await markAppointmentCompletedByStaff(id);
      setLoadingId(null);
      if (res.error) {
        setFeedback({ id, type: "error", text: res.error });
      } else {
        setFeedback({ id, type: "success", text: "Appointment marked completed!" });
        setTimeout(() => setFeedback(null), 3000);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Staff Profile Hero Card */}
      <Card className="p-6 bg-gradient-to-r from-cream via-paper to-cream border border-ink/10 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-gold/20 flex items-center justify-center text-gold-dark font-display text-xl font-bold border border-gold/30">
              {staff.full_name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-bold text-ink">{staff.full_name}</h1>
                <span className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  staff.is_active ? "bg-emerald-100 text-emerald-800" : "bg-ink/10 text-ink-soft"
                )}>
                  {staff.is_active ? "Active Staff" : "Inactive"}
                </span>
              </div>
              <p className="text-sm text-gold-dark font-medium">{staff.role_title || "Stylist & Aesthetician"}</p>
              {staff.bio && <p className="text-xs text-ink-soft mt-1 max-w-xl">{staff.bio}</p>}
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white p-3 text-center border border-ink/5 shadow-xs min-w-[85px]">
              <span className="text-xs text-ink-soft uppercase font-semibold">Today</span>
              <p className="font-display text-xl font-bold text-ink">{todayCount}</p>
            </div>
            <div className="rounded-xl bg-white p-3 text-center border border-ink/5 shadow-xs min-w-[85px]">
              <span className="text-xs text-ink-soft uppercase font-semibold">Upcoming</span>
              <p className="font-display text-xl font-bold text-gold-dark">{upcomingCount}</p>
            </div>
            <div className="rounded-xl bg-white p-3 text-center border border-ink/5 shadow-xs min-w-[85px]">
              <span className="text-xs text-ink-soft uppercase font-semibold">Completed</span>
              <p className="font-display text-xl font-bold text-emerald-700">{completedCount}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-ink/10 pb-4">
        {[
          { id: "upcoming", label: `Upcoming Active (${upcomingCount})` },
          { id: "today", label: `Today (${todayCount})` },
          { id: "completed", label: `Completed (${completedCount})` },
          { id: "all", label: `All Assigned (${appointments.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id as any)}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-200",
              filter === t.id 
                ? "bg-ink text-paper shadow-xs" 
                : "bg-cream text-ink-soft hover:text-gold-dark hover:bg-cream/80"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Bookings List */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <Card className="p-10 text-center text-ink-soft">
            <Sparkles className="mx-auto h-8 w-8 text-gold/40 mb-2" />
            <p className="font-display text-base font-semibold text-ink">No appointments found</p>
            <p className="text-xs text-ink-soft mt-1">
              {filter === "today" 
                ? "You have no appointments scheduled for today." 
                : "No appointments match this filter."}
            </p>
          </Card>
        ) : (
          filtered.map((appt) => {
            const isToday = appt.appointment_date === todayManila;
            const isCompleted = appt.status === "completed";
            const apptFeedback = feedback?.id === appt.id ? feedback : null;

            return (
              <Card 
                key={appt.id} 
                className={cn(
                  "p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border transition-all duration-200",
                  isToday ? "border-gold/40 bg-gold/5" : "border-ink/10 bg-white"
                )}
              >
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-base font-semibold text-ink">{appt.full_name}</span>
                    {isToday && (
                      <span className="rounded-full bg-gold-dark px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                        Today
                      </span>
                    )}
                    <span className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
                      isCompleted ? "bg-emerald-100 text-emerald-800" : "bg-ink/5 text-ink-soft"
                    )}>
                      {appt.status.replace("_", " ")}
                    </span>
                  </div>

                  {/* Service & Time */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-ink-soft">
                    <span className="font-medium text-ink">
                      {appt.services?.name ?? "Service"}
                      {appt.services?.duration_minutes ? ` (${appt.services.duration_minutes} mins)` : ""}
                    </span>
                    &middot;
                    <span className="flex items-center gap-1 font-medium text-ink">
                      <Calendar className="h-3.5 w-3.5 text-gold-dark" />
                      {new Date(`${appt.appointment_date}T00:00:00`).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    &middot;
                    <span className="flex items-center gap-1 font-medium text-ink">
                      <Clock className="h-3.5 w-3.5 text-gold-dark" />
                      {appt.appointment_time}
                    </span>
                  </div>

                  {/* Customer Contact */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-ink-soft pt-1">
                    {appt.phone && (
                      <a href={`tel:${appt.phone}`} className="flex items-center gap-1 text-ink-soft hover:text-gold-dark">
                        <Phone className="h-3 w-3" />
                        {appt.phone}
                      </a>
                    )}
                    {appt.email && (
                      <a href={`mailto:${appt.email}`} className="flex items-center gap-1 text-ink-soft hover:text-gold-dark">
                        <Mail className="h-3 w-3" />
                        {appt.email}
                      </a>
                    )}
                  </div>

                  {/* Notes */}
                  {appt.notes && (
                    <div className="flex items-start gap-1.5 rounded-lg bg-cream/70 p-2 text-xs text-ink-soft border border-ink/5">
                      <FileText className="h-3.5 w-3.5 text-ink-soft shrink-0 mt-0.5" />
                      <span className="italic">&ldquo;{appt.notes}&rdquo;</span>
                    </div>
                  )}

                  {/* Inline feedback */}
                  {apptFeedback && (
                    <div className={cn(
                      "flex items-center gap-1.5 p-2 rounded-md text-xs font-medium border",
                      apptFeedback.type === "success" 
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                        : "bg-rose-50 text-rose-800 border-rose-200"
                    )}>
                      {apptFeedback.type === "success" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-rose-600" />
                      )}
                      <span>{apptFeedback.text}</span>
                    </div>
                  )}
                </div>

                {/* Right Action */}
                <div className="flex flex-col sm:items-end gap-2 shrink-0">
                  <span className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-md text-center",
                    appt.payment_status === "fully_paid" 
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  )}>
                    {appt.payment_status === "fully_paid" ? "Paid in Full" : "Payment Due at Salon"}
                  </span>

                  {!isCompleted && appt.status !== "cancelled" ? (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs font-medium"
                      disabled={isPending || loadingId === appt.id}
                      onClick={() => handleComplete(appt.id)}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      {loadingId === appt.id ? "Updating..." : "Mark Completed"}
                    </Button>
                  ) : isCompleted ? (
                    <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Completed
                    </span>
                  ) : null}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
