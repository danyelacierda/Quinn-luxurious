"use client";

import { useMemo, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { createAppointment, fetchAvailableSlots } from "@/lib/actions/booking";
import type { ServiceRow, StaffRow, UserRow } from "@/lib/supabase/queries";
import { formatPHP } from "@/lib/format";
import { PAYMENT_CONFIG } from "@/lib/payment";
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
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qr_ph">("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [qrTab, setQrTab] = useState<"gcash" | "maya">("gcash");
  const [enlargedQr, setEnlargedQr] = useState<string | null>(null);
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
    formData.set("paymentMethod", paymentMethod);
    if (paymentMethod === "qr_ph") {
      formData.set("paymentReference", paymentReference);
    }

    startTransition(async () => {
      try {
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
      } catch (err) {
        console.error(err);
        setError("Network error. Please try again.");
      }
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
                      {service.duration_minutes} min &middot; {formatPHP(service.price)}
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
                      <span className="text-[10px] uppercase tracking-wider text-ink-soft/70 font-medium">
                        {d.toLocaleDateString(undefined, { month: "short" })}
                      </span>
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
                <div className="flex justify-between"><dt className="text-ink-soft">Price</dt><dd className="font-medium text-ink">{formatPHP(selectedService.price)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-soft">Name</dt><dd className="font-medium text-ink">{fullName}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-soft">Contact</dt><dd className="font-medium text-ink">{email} &middot; {phone}</dd></div>
              </dl>

              <div className="mt-6 space-y-4">
                <h4 className="font-display text-lg font-semibold text-ink">Payment Method</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={cn("flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-all", paymentMethod === "cash" ? "border-gold bg-gold/10 shadow-gold" : "border-ink/10 bg-white")}>
                    <input type="radio" name="paymentMethod" value="cash" checked={paymentMethod === "cash"} onChange={() => setPaymentMethod("cash")} className="hidden" />
                    <span className="font-medium text-ink">Pay at the salon</span>
                  </label>
                  <label className={cn("flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-all", paymentMethod === "qr_ph" ? "border-gold bg-gold/10 shadow-gold" : "border-ink/10 bg-white")}>
                    <input type="radio" name="paymentMethod" value="qr_ph" checked={paymentMethod === "qr_ph"} onChange={() => setPaymentMethod("qr_ph")} className="hidden" />
                    <span className="font-medium text-ink">QR Ph / E-Wallet</span>
                  </label>
                </div>

                {paymentMethod === "qr_ph" && (
                  <div className="mt-4 space-y-5 rounded-2xl bg-cream p-5 text-sm">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={qrTab === "gcash" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setQrTab("gcash")}
                        className={cn("flex-1", qrTab === "gcash" ? "bg-gold text-white hover:bg-gold-dark" : "bg-white text-ink hover:border-gold/40")}
                      >
                        GCash
                      </Button>
                      <Button
                        type="button"
                        variant={qrTab === "maya" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setQrTab("maya")}
                        className={cn("flex-1", qrTab === "maya" ? "bg-gold text-white hover:bg-gold-dark" : "bg-white text-ink hover:border-gold/40")}
                      >
                        Maya
                      </Button>
                    </div>

                    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                      <div className="flex flex-col items-center gap-3">
                        <div 
                          className="relative w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] shrink-0 bg-white rounded-xl flex items-center justify-center p-4 shadow-sm border border-ink/5 cursor-pointer hover:border-gold/40 transition-colors"
                          onClick={() => setEnlargedQr(qrTab === "gcash" ? PAYMENT_CONFIG.gcashQrPath : PAYMENT_CONFIG.mayaQrPath)}
                        >
                          <img 
                            src={qrTab === "gcash" ? PAYMENT_CONFIG.gcashQrPath : PAYMENT_CONFIG.mayaQrPath} 
                            alt={`${qrTab === "gcash" ? "GCash" : "Maya"} QR Code`} 
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <a 
                          href={qrTab === "gcash" ? PAYMENT_CONFIG.gcashQrPath : PAYMENT_CONFIG.mayaQrPath}
                          download
                          className="text-xs text-center text-gold-dark hover:underline font-medium"
                        >
                          Save QR image
                        </a>
                      </div>
                      
                      <div className="flex-1 space-y-2 text-center sm:text-left">
                        <p className="text-ink-soft text-sm">Account Name:</p>
                        <p className="font-bold text-lg text-ink leading-tight">{PAYMENT_CONFIG.accountName}</p>
                        <p className="text-2xl font-display font-semibold text-gold-dark mt-4">{formatPHP(selectedService.price)}</p>
                        <p className="text-xs text-ink-soft">Please send exact amount via {qrTab === "gcash" ? "GCash" : "Maya"}.</p>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="paymentReference">Reference Number</Label>
                      <Input
                        id="paymentReference"
                        placeholder="e.g. 000123456789"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value.toUpperCase())}
                        required
                        className="mt-1 font-mono uppercase"
                      />
                    </div>
                  </div>
                )}
              </div>
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

      <AnimatePresence>
        {enlargedQr && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm"
            onClick={() => setEnlargedQr(null)}
          >
            <div 
              className="relative w-full max-w-2xl bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                className="absolute top-4 right-4 text-ink-soft hover:text-ink bg-cream hover:bg-gold/10 hover:text-gold-dark rounded-full p-2 transition-colors"
                onClick={() => setEnlargedQr(null)}
              >
                <X className="h-5 w-5" />
              </button>
              <img src={enlargedQr} alt="Enlarged QR Code" className="w-full h-auto max-h-[80vh] object-contain" />
              <p className="mt-4 font-semibold text-ink text-center">{PAYMENT_CONFIG.accountName}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
