"use client";

import { useMemo, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { createAppointment, fetchAvailableSlots } from "@/lib/actions/booking";
import type { ServiceRow, StaffRow, UserRow } from "@/lib/supabase/queries";
import { cn } from "@/lib/utils";

type Props = {
  services: ServiceRow[];
  staff: StaffRow[];
  defaultUser: UserRow | null;
};

const STEP_LABELS = ["Service", "Date & Time", "Your Details", "Confirm"];

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

export function BookingFlow({ services, staff, defaultUser }: Props) {
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState<string>("");
  const [staffId, setStaffId] = useState<string>(""); // "" = any available
  const [dateISO, setDateISO] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [fullName, setFullName] = useState(defaultUser?.full_name ?? "");
  const [email, setEmail] = useState(defaultUser?.email ?? "");
  const [phone, setPhone] = useState(defaultUser?.phone ?? "");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedService = useMemo(() => services.find((s) => s.id === serviceId) ?? null, [services, serviceId]);
  const days = useMemo(() => nextNDays(21), []);

  async function loadSlots(iso: string) {
    if (!selectedService) return;
    setLoadingSlots(true);
    setTime("");
    try {
      const available = await fetchAvailableSlots(iso, staffId || null, selectedService.duration_minutes);
      setSlots(available);
    } finally {
      setLoadingSlots(false);
    }
  }

  function handlePickDate(iso: string) {
    setDateISO(iso);
    loadSlots(iso);
  }

  function handleStaffChange(value: string) {
    setStaffId(value);
    if (dateISO) loadSlots(dateISO);
  }

  function goNext() {
    setError(null);
    if (step === 0 && !serviceId) return setError("Please choose a service to continue.");
    if (step === 1 && (!dateISO || !time)) return setError("Please choose a date and time to continue.");
    if (step === 2 && (!fullName.trim() || !email.trim() || !phone.trim())) {
      return setError("Please fill in your name, email, and phone.");
    }
    setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  function handleConfirm() {
    setError(null);
    const formData = new FormData();
    formData.set("serviceId", serviceId);
    formData.set("staffId", staffId);
    formData.set("date", dateISO);
    formData.set("time", time);
    formData.set("fullName", fullName);
    formData.set("phone", phone);
    formData.set("email", email);
    formData.set("notes", notes);

    startTransition(async () => {
      const result = await createAppointment(formData);
      if (!result.ok) {
        setError(result.error);
        if (result.slotTaken) {
          setTime("");
          if (dateISO) loadSlots(dateISO);
          setStep(1);
        }
        return;
      }
      setConfirmedId(result.appointmentId);
    });
  }

  if (confirmedId) {
    return (
      <Card className="p-10 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold/10 text-gold-dark ring-1 ring-gold/25">
          <Check className="h-7 w-7" strokeWidth={1.75} />
        </span>
        <h2 className="mt-6 font-display text-2xl font-semibold text-ink">You&rsquo;re all set</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          {selectedService?.name} on {new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}{" "}
          at {time}. A confirmation has been sent to {email}.
        </p>
        <Button size="lg" className="mt-8" onClick={() => window.location.assign("/account")}>
          View My Appointments
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-10">
      {/* Step indicator */}
      <div className="mb-8 flex items-center justify-between">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  i < step ? "bg-gold text-ivory" : i === step ? "bg-ink text-paper" : "bg-cream text-ink-soft"
                )}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className="hidden text-[11px] font-medium text-ink-soft sm:block">{label}</span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={cn("mx-2 h-px flex-1", i < step ? "bg-gold" : "bg-cream")} />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {step === 0 && (
            <div className="space-y-3">
              <h3 className="font-display text-xl font-semibold text-ink">Choose a service</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {services.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => setServiceId(service.id)}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition-all duration-200",
                      serviceId === service.id
                        ? "border-gold bg-gold/10 shadow-gold"
                        : "border-ink/10 bg-white hover:border-gold/40"
                    )}
                  >
                    <p className="font-display text-base font-semibold text-ink">{service.name}</p>
                    <p className="mt-1 text-xs text-ink-soft">
                      {service.duration_minutes} min &middot; ${service.price}
                    </p>
                  </button>
                ))}
              </div>
              {staff.length > 0 && (
                <div className="pt-4">
                  <Label htmlFor="staff">Preferred artist (optional)</Label>
                  <Select id="staff" value={staffId} onChange={(e) => handleStaffChange(e.target.value)}>
                    <option value="">Any available artist</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name}
                        {s.role_title ? ` — ${s.role_title}` : ""}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <h3 className="font-display text-xl font-semibold text-ink">Pick a date</h3>
              <div className="flex gap-2 overflow-x-auto pb-2 ql-scrollbar">
                {days.map((d) => {
                  const iso = toISODate(d);
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => handlePickDate(iso)}
                      className={cn(
                        "flex min-w-[64px] flex-col items-center rounded-2xl border px-3 py-2.5 transition-all duration-200",
                        dateISO === iso ? "border-gold bg-gold/10 shadow-gold" : "border-ink/10 bg-white hover:border-gold/40"
                      )}
                    >
                      <span className="text-[11px] uppercase tracking-wide text-ink-soft">
                        {d.toLocaleDateString(undefined, { weekday: "short" })}
                      </span>
                      <span className="font-display text-lg font-semibold text-ink">{d.getDate()}</span>
                    </button>
                  );
                })}
              </div>

              {dateISO && (
                <div>
                  <h3 className="font-display text-xl font-semibold text-ink">Pick a time</h3>
                  {loadingSlots ? (
                    <div className="mt-4 flex items-center gap-2 text-sm text-ink-soft">
                      <Loader2 className="h-4 w-4 animate-spin" /> Checking availability…
                    </div>
                  ) : slots.length === 0 ? (
                    <p className="mt-4 text-sm text-ink-soft">No times left on this date — try another day.</p>
                  ) : (
                    <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {slots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setTime(slot)}
                          className={cn(
                            "rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-200",
                            time === slot ? "border-gold bg-gold/10 text-gold-dark shadow-gold" : "border-ink/10 bg-white text-ink hover:border-gold/40"
                          )}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h3 className="font-display text-xl font-semibold text-ink">Your details</h3>
              <div>
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything we should know before your visit?" />
              </div>
            </div>
          )}

          {step === 3 && selectedService && (
            <div className="space-y-4">
              <h3 className="font-display text-xl font-semibold text-ink">Review &amp; confirm</h3>
              <dl className="space-y-2 rounded-2xl bg-cream p-5 text-sm">
                <div className="flex justify-between"><dt className="text-ink-soft">Service</dt><dd className="font-medium text-ink">{selectedService.name}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-soft">Date</dt><dd className="font-medium text-ink">{new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-soft">Time</dt><dd className="font-medium text-ink">{time}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-soft">Price</dt><dd className="font-medium text-ink">${selectedService.price}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-soft">Name</dt><dd className="font-medium text-ink">{fullName}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-soft">Contact</dt><dd className="font-medium text-ink">{email} &middot; {phone}</dd></div>
              </dl>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {error && <p className="mt-5 text-sm text-rose-dark">{error}</p>}

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={goBack} disabled={step === 0 || isPending} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        {step < STEP_LABELS.length - 1 ? (
          <Button onClick={goNext} className="gap-1">
            Continue <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleConfirm} disabled={isPending} className="gap-2">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm Appointment
          </Button>
        )}
      </div>
    </Card>
  );
}
