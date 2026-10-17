"use client";

import { useState, useTransition, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { 
  updateAppointmentStatus, 
  markPaidInCash, 
  confirmPayment, 
  assignStaffToAppointment 
} from "@/lib/actions/admin";
import type { AppointmentWithDetails, StaffRow } from "@/lib/supabase/queries";
import type { AppointmentStatus } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { 
  Banknote, 
  CheckCircle, 
  User, 
  AlertCircle, 
  CheckCircle2, 
  Calendar,
  Clock
} from "lucide-react";
import {
  type AppointmentTab,
  getAppointmentTabCounts,
  getTabAppointmentsGroupedByDate,
} from "@/lib/appointments/admin-tabs";

function statusStyles(status: string) {
  if (status === "cancelled") return "bg-ink/5 text-ink-soft";
  if (status === "completed") return "bg-emerald-100 text-emerald-800";
  if (status === "confirmed") return "bg-gold/15 text-gold-dark";
  return "bg-rose/20 text-rose-dark";
}

type Props = {
  appointments: AppointmentWithDetails[];
  staff?: StaffRow[];
};

export function AdminAppointmentsTab({ appointments, staff = [] }: Props) {
  const [activeTab, setActiveTab] = useState<AppointmentTab>("upcoming");
  const [isPending, startTransition] = useTransition();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [appointmentErrors, setAppointmentErrors] = useState<Record<string, string>>({});
  const [appointmentSuccesses, setAppointmentSuccesses] = useState<Record<string, string>>({});

  // Compute live tab counts across all appointments
  const counts = useMemo(() => {
    return getAppointmentTabCounts(appointments);
  }, [appointments]);

  // Filter, sort, and group appointments for the active tab
  const dateGroups = useMemo(() => {
    return getTabAppointmentsGroupedByDate(appointments, activeTab);
  }, [appointments, activeTab]);

  function handleStatusChange(id: string, status: AppointmentStatus) {
    setAppointmentErrors((prev) => ({ ...prev, [id]: "" }));
    setAppointmentSuccesses((prev) => ({ ...prev, [id]: "" }));
    startTransition(async () => {
      const res = await updateAppointmentStatus(id, status);
      if (res.error) {
        setAppointmentErrors((prev) => ({ ...prev, [id]: res.error || "Update failed." }));
      }
    });
  }

  function handleStaffAssign(appointmentId: string, staffId: string) {
    setAppointmentErrors((prev) => ({ ...prev, [appointmentId]: "" }));
    setAppointmentSuccesses((prev) => ({ ...prev, [appointmentId]: "" }));
    const finalStaffId = staffId === "unassigned" ? null : staffId;

    startTransition(async () => {
      const res = await assignStaffToAppointment(appointmentId, finalStaffId);
      if (res.error) {
        setAppointmentErrors((prev) => ({ ...prev, [appointmentId]: res.error || "Assignment failed." }));
      } else {
        setAppointmentSuccesses((prev) => ({ 
          ...prev, 
          [appointmentId]: finalStaffId ? "Staff assigned." : "Appointment unassigned." 
        }));
        setTimeout(() => {
          setAppointmentSuccesses((prev) => ({ ...prev, [appointmentId]: "" }));
        }, 3000);
      }
    });
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

  const tabs: { id: AppointmentTab; label: string; count: number }[] = [
    { id: "upcoming", label: "Upcoming", count: counts.upcoming },
    { id: "completed", label: "Completed", count: counts.completed },
    { id: "cancelled", label: "Cancelled", count: counts.cancelled },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-tabs for filtering appointments */}
      <div className="flex flex-wrap items-center gap-2 border-b border-ink/10 pb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs sm:text-sm font-medium transition-all duration-200 flex items-center gap-2",
              activeTab === t.id
                ? "bg-ink text-paper shadow-sm"
                : "bg-cream text-ink-soft hover:text-gold-dark hover:bg-cream/80"
            )}
          >
            <span>{t.label}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                activeTab === t.id
                  ? "bg-paper/20 text-paper"
                  : "bg-ink/10 text-ink-soft"
              )}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Empty State for Selected Tab */}
      {dateGroups.length === 0 ? (
        <Card className="p-8 text-center text-ink-soft">
          No {activeTab} appointments found.
        </Card>
      ) : (
        /* Date-grouped appointments list */
        <div className="space-y-8">
          {dateGroups.map((group) => (
            <div key={group.date} className="space-y-3">
              {/* Date Header */}
              <div className="flex items-center gap-2 border-b border-gold/20 pb-2 pt-1">
                <Calendar className="h-4 w-4 text-gold-dark" />
                <h3 className="font-display text-sm sm:text-base font-semibold text-ink">
                  {group.formattedDate}
                </h3>
                <span className="text-xs text-ink-soft font-normal">
                  ({group.appointments.length} {group.appointments.length === 1 ? "booking" : "bookings"})
                </span>
              </div>

              {/* Appointments under this date */}
              <div className="space-y-4">
                {group.appointments.map((appt) => {
                  const errorMsg = appointmentErrors[appt.id];
                  const successMsg = appointmentSuccesses[appt.id];

                  return (
                    <Card
                      key={appt.id}
                      className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between border border-ink/10 shadow-sm"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-display text-base font-semibold text-ink">
                            {appt.full_name}
                          </p>
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
                              statusStyles(appt.status)
                            )}
                          >
                            {appt.status.replace("_", " ")}
                          </span>
                        </div>

                        <p className="text-sm text-ink-soft">
                          <strong className="text-ink">
                            {appt.services?.name ?? "Service"}
                          </strong>{" "}
                          &middot;{" "}
                          <span className="inline-flex items-center gap-1 font-medium text-ink">
                            <Clock className="h-3 w-3 inline text-ink-soft" />
                            {appt.appointment_time}
                          </span>
                        </p>

                        <p className="text-xs text-ink-soft">
                          {appt.email} &middot; {appt.phone}
                        </p>

                        {appt.notes && (
                          <p className="text-xs italic text-ink-soft/90 bg-cream/70 p-1.5 rounded-md mt-1 border border-ink/5">
                            &ldquo;{appt.notes}&rdquo;
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium">
                          <span
                            className={cn(
                              "rounded-md px-2 py-0.5",
                              appt.payment_status === "fully_paid"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            )}
                          >
                            Payment:{" "}
                            {appt.payment_status === "fully_paid"
                              ? "Fully Paid"
                              : appt.payment_method === "qr_ph"
                              ? "QR Ph (Awaiting Confirmation)"
                              : "Cash / Salon Pay"}
                          </span>

                          {appt.payment_method && (
                            <span className="rounded-md bg-ink/5 px-2 py-0.5 text-ink-soft capitalize">
                              Method: {appt.payment_method}
                            </span>
                          )}

                          {appt.needs_refund && (
                            <span className="rounded-md bg-rose-100 px-2 py-0.5 text-rose-800 font-semibold">
                              Needs Refund / Review
                            </span>
                          )}
                        </div>

                        {/* Inline error / success feedback */}
                        {errorMsg && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-600 bg-rose-50 p-2 rounded-md border border-rose-200">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>{errorMsg}</span>
                          </div>
                        )}
                        {successMsg && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 p-2 rounded-md border border-emerald-200">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            <span>{successMsg}</span>
                          </div>
                        )}
                      </div>

                      {/* Right side controls: Staff assignment, status, and payment actions */}
                      <div className="flex flex-col gap-3 sm:items-end border-t border-ink/5 pt-3 sm:border-0 sm:pt-0">
                        {/* Staff Assignment Dropdown */}
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-ink-soft shrink-0" />
                          <Select
                            className="h-8 w-44 text-xs font-medium bg-white"
                            value={appt.staff_id ?? "unassigned"}
                            disabled={isPending || appt.status === "cancelled"}
                            onChange={(e) => handleStaffAssign(appt.id, e.target.value)}
                          >
                            <option value="unassigned">-- Unassigned --</option>
                            {staff.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.full_name} {s.is_active ? "" : "(Inactive)"}
                              </option>
                            ))}
                          </Select>
                        </div>

                        {/* Appointment Status Dropdown */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-ink-soft">Status:</span>
                          <Select
                            className="h-8 w-36 text-xs bg-white"
                            defaultValue={appt.status}
                            disabled={isPending}
                            onChange={(e) =>
                              handleStatusChange(appt.id, e.target.value as AppointmentStatus)
                            }
                          >
                            <option value="pending_payment">Pending Payment</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </Select>
                        </div>

                        {/* Mark as Paid Action Buttons */}
                        {appt.status === "confirmed" &&
                          appt.payment_status !== "fully_paid" && (
                            <div className="flex items-center gap-2">
                              <Button
                                variant="default"
                                size="sm"
                                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => handleMarkPaid(appt.id)}
                                disabled={loadingAction === `cash-${appt.id}`}
                              >
                                <Banknote className="mr-1 h-3 w-3" /> Mark Cash Paid
                              </Button>
                              {appt.payment_method === "qr_ph" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => handleConfirmQR(appt.id)}
                                  disabled={loadingAction === `qr-${appt.id}`}
                                >
                                  <CheckCircle className="mr-1 h-3 w-3" /> Confirm QR
                                </Button>
                              )}
                            </div>
                          )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
