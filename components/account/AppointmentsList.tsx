"use client";

function paymentMethodLabel(method: string | null) {
  if (method === "stripe") return "Card (Stripe Test)";
  if (method === "qr_ph") return "QR Ph / E-Wallet";
  return "Pay at the salon";
}

function paymentStatusLabel(paymentStatus: string, method: string | null) {
  if (paymentStatus === "fully_paid") {
    return method === "stripe" ? "Paid in full (Stripe)" : "Paid in full";
  }
  if (paymentStatus === "pending_payment") {
    return method === "stripe" ? "Pending Stripe payment" : "Awaiting verification";
  }
  if (paymentStatus === "failed") {
    return "Payment failed";
  }
  if (paymentStatus === "expired") {
    return "Checkout expired";
  }
  return "Due on arrival";
}



import { useState, useTransition } from "react";
import { Calendar, Clock, Loader2, X, AlertCircle, User, CreditCard, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookingCalendar } from "@/components/booking/BookingCalendar";
import { cancelAppointment, rescheduleAppointment } from "@/lib/actions/account";
import { fetchAvailableSlots } from "@/lib/actions/booking";
import type { AppointmentWithDetails } from "@/lib/supabase/queries";
import { formatPHP } from "@/lib/format";
import { cn } from "@/lib/utils";

function statusStyles(status: string) {
  switch (status) {
    case "confirmed":
      return "bg-gold/15 text-gold-dark border-gold/30";
    case "completed":
      return "bg-ink/10 text-ink border-ink/20";
    case "cancelled":
      return "bg-ink/5 text-ink-soft/70 border-ink/10";
    case "pending":
    case "pending_payment":
      return "bg-rose/20 text-rose-dark border-rose/30";
    default:
      return "bg-paper text-ink-soft border-border";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "confirmed":
      return "Confirmed";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "pending":
      return "Pending Confirmation";
    case "pending_payment":
      return "Pending Payment";
    default:
      return status;
  }
}

function AppointmentCard({ appt }: { appt: AppointmentWithDetails }) {
  const [isPending, startTransition] = useTransition();
  const [rescheduling, setRescheduling] = useState(false);
  const [dateISO, setDateISO] = useState("");
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const canModify = appt.status === "confirmed" || appt.status === "pending";

  function handleCancel() {
    if (!window.confirm("Are you sure you want to cancel this appointment?")) {
      return;
    }
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const result = await cancelAppointment(appt.id);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccessMsg("Appointment cancelled successfully.");
      }
    });
  }

  async function loadSlots(iso: string) {
    setLoadingSlots(true);
    setTime("");
    setError(null);
    try {
      const available = await fetchAvailableSlots(iso, appt.staff_id, appt.services?.duration_minutes ?? 60);
      setSlots(available);
    } catch (err) {
      console.error(err);
      setError("Unable to load slots for this date. Please try another day.");
    } finally {
      setLoadingSlots(false);
    }
  }

  function handleConfirmReschedule() {
    if (!dateISO || !time) {
      setError("Please pick both a date and an available time.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await rescheduleAppointment(appt.id, dateISO, time);
      if (result.error) {
        setError(result.error);
        return;
      }
      setRescheduling(false);
      setSuccessMsg(`Rescheduled to ${dateISO} at ${time}.`);
    });
  }

  return (
    <Card className="overflow-hidden rounded-3xl border-gold/20 bg-white p-6 shadow-sm sm:p-7 transition-all duration-200 hover:border-gold/30">
      {/* Top Header: Service, Price, Status */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="eyebrow text-gold-dark">Service Appointment</span>
          <h3 className="mt-1 font-display text-2xl font-semibold text-ink">
            {appt.services?.name ?? "Custom Salon Treatment"}
          </h3>

          <div className="mt-2.5 flex flex-wrap items-center gap-3 text-sm text-ink-soft">
            <span className="flex items-center gap-1.5 font-medium text-ink">
              <Calendar className="h-4 w-4 text-gold-dark" />
              {new Date(`${appt.appointment_date}T00:00:00`).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <span>&bull;</span>
            <span className="flex items-center gap-1.5 font-medium text-ink">
              <Clock className="h-4 w-4 text-gold-dark" />
              {appt.appointment_time}
            </span>
            {appt.services?.duration_minutes && (
              <>
                <span>&bull;</span>
                <span>{appt.services.duration_minutes} min</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span
            className={cn(
              "rounded-full px-3.5 py-1 text-xs font-semibold uppercase tracking-wide border",
              statusStyles(appt.status)
            )}
          >
            {statusLabel(appt.status)}
          </span>
          {appt.services?.price !== undefined && (
            <span className="font-display text-xl font-semibold text-gold-dark">
              {formatPHP(appt.services.price)}
            </span>
          )}
        </div>
      </div>

      {/* Details Row: Artist, Payment, Reference */}
      <div className="mt-5 grid sm:grid-cols-2 gap-3 rounded-2xl bg-cream/70 p-4 text-xs">
        <div className="flex items-center gap-2 text-ink-soft">
          <User className="h-4 w-4 text-gold-dark shrink-0" />
          <span>
            {appt.staff?.full_name ? (
              <>Artist: <strong className="text-ink">{appt.staff.full_name}</strong></>
            ) : (
              "Artist: Any available specialist"
            )}
          </span>
        </div>

        <div className="flex items-center gap-2 text-ink-soft">
          <CreditCard className="h-4 w-4 text-gold-dark shrink-0" />
          <span>
            Payment:{" "}
            <strong className="text-ink">
              {paymentMethodLabel(appt.payment_method)}
            </strong>{" "}
            &bull;{" "}
            <span className={cn("italic font-medium", appt.payment_status === "fully_paid" ? "text-gold-dark" : "text-ink-soft")}>
              {paymentStatusLabel(appt.payment_status, appt.payment_method)}
            </span>
          </span>
        </div>

        {appt.payment_reference && (
          <div className="sm:col-span-2 text-ink-soft font-mono text-[11px] bg-white/70 px-2.5 py-1 rounded-lg border border-gold/15 inline-flex items-center gap-1.5 w-fit">
            <span>Reference:</span>
            <strong className="text-ink tracking-wider">{appt.payment_reference}</strong>
          </div>
        )}

        {appt.notes && (
          <div className="sm:col-span-2 text-ink-soft italic pt-1 border-t border-gold/10">
            Note: &ldquo;{appt.notes}&rdquo;
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {canModify && (
        <div className="mt-5 flex items-center gap-3 border-t border-gold/10 pt-4">
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => {
              setRescheduling((v) => !v);
              setError(null);
              setSuccessMsg(null);
            }}
            className="border-gold/30 hover:border-gold hover:bg-gold/10 text-ink"
          >
            {rescheduling ? "Close Reschedule" : "Reschedule Appointment"}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleCancel}
            disabled={isPending}
            className="gap-1.5 text-rose-dark hover:bg-rose/10 hover:text-rose-dark"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            Cancel Appointment
          </Button>
        </div>
      )}

      {/* Reschedule Drawer with Month Grid Calendar */}
      {rescheduling && (
        <div className="mt-5 rounded-3xl bg-paper p-5 border border-gold/20 space-y-4">
          <div>
            <h4 className="font-display text-lg font-semibold text-ink">Select a New Date &amp; Time</h4>
            <p className="text-xs text-ink-soft mt-0.5">
              Choose a new date on the calendar. We&rsquo;ll check real-time availability for you.
            </p>
          </div>

          <BookingCalendar
            selectedDate={dateISO}
            onSelectDate={(iso) => {
              setDateISO(iso);
              loadSlots(iso);
            }}
          />

          {dateISO && (
            <div className="pt-2">
              <h5 className="font-display text-base font-semibold text-ink mb-2">
                Available Times on {dateISO}
              </h5>

              {loadingSlots ? (
                <div role="status" className="flex items-center gap-2 py-4 text-sm font-medium text-gold-dark">
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking salon availability...
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-ink-soft py-2">No remaining times open on this date. Please pick another day.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((slot) => {
                    const isSelected = time === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setTime(slot)}
                        className={cn(
                          "rounded-xl border px-2.5 py-2 text-xs font-medium transition-all duration-200",
                          isSelected
                            ? "border-gold bg-gold text-white font-semibold shadow-gold"
                            : "border-ink/10 bg-white text-ink hover:border-gold/40 hover:bg-gold/5"
                        )}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 flex items-center gap-2">
                <Button
                  size="sm"
                  disabled={!dateISO || !time || isPending}
                  onClick={handleConfirmReschedule}
                  className="shadow-gold min-w-[140px]"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Saving...
                    </>
                  ) : (
                    "Confirm New Time"
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRescheduling(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div role="alert" className="mt-4 flex items-center gap-2 rounded-xl border border-rose-dark/25 bg-rose/10 p-3 text-xs text-rose-dark">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div role="status" className="mt-4 flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 p-3 text-xs text-gold-dark font-medium">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
    </Card>
  );
}

export function AppointmentsList({ appointments }: { appointments: AppointmentWithDetails[] }) {
  if (appointments.length === 0) {
    return (
      <Card className="p-12 text-center rounded-3xl border-gold/20 bg-white shadow-card">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold/10 text-gold-dark ring-4 ring-gold/15 mb-4">
          <Calendar className="h-6 w-6 stroke-[1.75]" />
        </div>
        <h3 className="font-display text-2xl font-semibold text-ink">No Appointments Yet</h3>
        <p className="mt-2 text-sm text-ink-soft max-w-sm mx-auto">
          You don&rsquo;t have any scheduled appointments. Explore our treatment menu and book your private session.
        </p>
        <Button asChild className="mt-6 shadow-gold">
          <a href="/appointment">Book Treatment</a>
        </Button>
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
