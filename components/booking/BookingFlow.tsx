"use client";

import { useMemo, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Loader2, X, Clock, AlertCircle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { BookingCalendar } from "@/components/booking/BookingCalendar";
import { createAppointment, fetchAvailableSlots } from "@/lib/actions/booking";
import type { ServiceRow, StaffRow, UserRow } from "@/lib/supabase/queries";
import { imageForService } from "@/lib/serviceIcons";
import { formatPHP } from "@/lib/format";
import { PAYMENT_CONFIG } from "@/lib/payment";
import { cn } from "@/lib/utils";

type Props = {
  services: ServiceRow[];
  staff: StaffRow[];
  defaultUser: UserRow | null;
  initialServiceId?: string;
};

const STEP_LABELS = ["Service", "Date & Time", "Your Details", "Confirm"];

export function BookingFlow({ services, staff, defaultUser, initialServiceId }: Props) {
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState<string>(() => {
    if (initialServiceId && services.some((s) => s.id === initialServiceId)) {
      return initialServiceId;
    }
    return "";
  });
  const [staffId, setStaffId] = useState<string>(""); // "" = any available
  const [dateISO, setDateISO] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [fullName, setFullName] = useState(defaultUser?.full_name ?? "");
  const [email, setEmail] = useState(defaultUser?.email ?? "");
  const [phone, setPhone] = useState(defaultUser?.phone ?? "");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qr_ph" | "stripe">("stripe");
  const [paymentReference, setPaymentReference] = useState("");
  const [qrTab, setQrTab] = useState<"gcash" | "maya">("gcash");
  const [enlargedQr, setEnlargedQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedService = useMemo(() => services.find((s) => s.id === serviceId) ?? null, [services, serviceId]);

  async function loadSlots(iso: string) {
    if (!selectedService) return;
    setLoadingSlots(true);
    setTime("");
    try {
      const available = await fetchAvailableSlots(iso, staffId || null, selectedService.duration_minutes);
      setSlots(available);
    } catch (err) {
      console.error(err);
      setError("Unable to retrieve available times. Please try again.");
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
    if (step === 0 && !serviceId) return setError("Please select a service to continue.");
    if (step === 1 && (!dateISO || !time)) return setError("Please select both a date and an available time slot.");
    if (step === 2 && (!fullName.trim() || !email.trim() || !phone.trim())) {
      return setError("Please fill in your full name, email address, and phone number.");
    }
    setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  }

  function goBack() {
    if (isPending) return;
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  function handleConfirm() {
    if (isPending) return;
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

        if (result.checkoutUrl) {
          window.location.assign(result.checkoutUrl);
          return;
        }
        setConfirmedId(result.appointmentId);
      } catch (err) {
        console.error(err);
        setError("Network error encountered. Please check your connection and try again.");
      }
    });
  }

  if (confirmedId) {
    return (
      <Card className="p-8 text-center sm:p-12">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold/15 text-gold-dark ring-4 ring-gold/20">
          <Check className="h-8 w-8" strokeWidth={2} />
        </span>
        <h2 className="mt-6 font-display text-3xl font-semibold text-ink">You&rsquo;re all set</h2>
        <p className="mt-3 text-base leading-relaxed text-ink-soft max-w-lg mx-auto">
          {selectedService?.name} scheduled for{" "}
          <span className="font-semibold text-ink">
            {new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>{" "}
          at <span className="font-semibold text-ink">{time}</span>. A booking confirmation has been sent to{" "}
          <span className="font-medium text-ink">{email}</span>.
        </p>
        <Button size="lg" className="mt-8" onClick={() => window.location.assign("/account")}>
          View My Appointments
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-10 shadow-card">
      {/* Step Indicator */}
      <div className="mb-8 flex items-center justify-between" aria-label="Booking steps">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-200",
                  i < step
                    ? "bg-gold text-ivory"
                    : i === step
                    ? "bg-ink text-paper ring-2 ring-gold/40"
                    : "bg-cream text-ink-soft"
                )}
                aria-current={i === step ? "step" : undefined}
              >
                {i < step ? <Check className="h-4 w-4 stroke-[2.5]" /> : i + 1}
              </span>
              <span className="hidden text-[11px] font-medium text-ink-soft sm:block">{label}</span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={cn("mx-2 h-0.5 flex-1 transition-colors", i < step ? "bg-gold" : "bg-cream")} />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -14 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          {/* STEP 0: SERVICE SELECTION */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-2xl font-semibold text-ink">Choose a service</h3>
                <span className="text-xs text-ink-soft">{services.length} signature treatments</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-all duration-200 sm:col-span-2",
                      paymentMethod === "stripe" ? "border-gold bg-gold/10 shadow-gold" : "border-ink/10 bg-white hover:border-gold/30"
                    )}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="stripe"
                      checked={paymentMethod === "stripe"}
                      onChange={() => setPaymentMethod("stripe")}
                      className="hidden"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-ink">Credit / Debit Card</p>
                        <span className="rounded-full bg-gold/15 text-gold-dark text-[10px] font-semibold px-2.5 py-0.5 border border-gold/25">
                          Stripe Test Mode
                        </span>
                      </div>
                      <p className="text-xs text-ink-soft mt-0.5">
                        Instant reservation &amp; receipt via Stripe Checkout test sandbox
                      </p>
                    </div>
                  </label>
                {services.map((service) => {
                  const isSelected = serviceId === service.id;
                  const thumb = imageForService(service);

                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => setServiceId(service.id)}
                      className={cn(
                        "group relative flex items-center gap-3.5 rounded-2xl border p-3.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                        isSelected
                          ? "border-gold bg-gold/10 shadow-gold ring-1 ring-gold/50"
                          : "border-ink/10 bg-white hover:border-gold/40 hover:bg-cream/40"
                      )}
                    >
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-cream">
                        <img
                          src={thumb}
                          alt={service.name}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/gallery/studio_interior.jpg";
                          }}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-display text-base font-semibold text-ink truncate">{service.name}</p>
                          {isSelected && <Check className="h-4 w-4 shrink-0 text-gold-dark stroke-[2.5]" />}
                        </div>
                        <p className="text-[11px] uppercase tracking-wider text-gold-dark font-medium mt-0.5">
                          {service.category}
                        </p>
                        <p className="mt-1 text-xs text-ink-soft">
                          {service.duration_minutes} min &middot;{" "}
                          <span className="font-semibold text-ink">{formatPHP(service.price)}</span>
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {staff.length > 0 && (
                <div className="pt-4 border-t border-gold/10">
                  <Label htmlFor="staff">Preferred artist (optional)</Label>
                  <Select id="staff" value={staffId} onChange={(e) => handleStaffChange(e.target.value)}>
                    <option value="">Any available artist (Recommended)</option>
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

          {/* STEP 1: DATE & TIME */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-display text-2xl font-semibold text-ink">Select date</h3>
                <p className="mt-1 text-xs text-ink-soft">
                  Operating in Asia/Manila (UTC+8). Sundays: 11:00 AM – 4:00 PM, Mon-Fri: 9:00 AM – 7:00 PM, Sat: 9:00 AM – 6:00 PM.
                </p>
              </div>

              <BookingCalendar
                selectedDate={dateISO}
                onSelectDate={handlePickDate}
              />

              {dateISO && (
                <div className="pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-xl font-semibold text-ink">Pick an appointment time</h3>
                    <span className="text-xs text-ink-soft">
                      {new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>

                  {loadingSlots ? (
                    <div
                      role="status"
                      aria-live="polite"
                      className="mt-4 flex items-center justify-center gap-2.5 rounded-2xl bg-gold/5 p-5 text-sm font-medium text-gold-dark border border-gold/15"
                    >
                      <Loader2 className="h-4 w-4 animate-spin text-gold-dark" />
                      Checking real-time salon availability...
                    </div>
                  ) : slots.length === 0 ? (
                    <div className="mt-4 rounded-2xl bg-paper p-5 text-center text-sm text-ink-soft border border-ink/10">
                      No bookable times left for this date. Please select another date on the calendar above.
                    </div>
                  ) : (
                    <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                      {slots.map((slot) => {
                        const isSelected = time === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setTime(slot)}
                            aria-pressed={isSelected}
                            className={cn(
                              "flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                              isSelected
                                ? "border-gold bg-gold text-white font-semibold shadow-gold scale-[1.02]"
                                : "border-ink/10 bg-white text-ink hover:border-gold/40 hover:bg-gold/5"
                            )}
                          >
                            <Clock className={cn("h-3.5 w-3.5", isSelected ? "text-white" : "text-gold-dark")} />
                            <span>{slot}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: YOUR DETAILS */}
          {step === 2 && (
            <div className="space-y-5">
              <h3 className="font-display text-2xl font-semibold text-ink">Your contact details</h3>
              <div>
                <Label htmlFor="fullName">Full name *</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Maria Santos"
                  required
                />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="email">Email address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="maria@example.com"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0917 123 4567"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Special requests or allergy notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tell us about sensitive eyes, lash length preferences, or any specific requests..."
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* STEP 3: CONFIRMATION & PAYMENT */}
          {step === 3 && selectedService && (
            <div className="space-y-6">
              <h3 className="font-display text-2xl font-semibold text-ink">Review &amp; Confirm</h3>
              <dl className="space-y-3 rounded-2xl bg-cream p-5 text-sm">
                <div className="flex justify-between border-b border-gold/10 pb-2">
                  <dt className="text-ink-soft">Service</dt>
                  <dd className="font-medium text-ink">{selectedService.name}</dd>
                </div>
                <div className="flex justify-between border-b border-gold/10 pb-2">
                  <dt className="text-ink-soft">Date</dt>
                  <dd className="font-medium text-ink">
                    {new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </dd>
                </div>
                <div className="flex justify-between border-b border-gold/10 pb-2">
                  <dt className="text-ink-soft">Time</dt>
                  <dd className="font-medium text-ink">{time}</dd>
                </div>
                <div className="flex justify-between border-b border-gold/10 pb-2">
                  <dt className="text-ink-soft">Price</dt>
                  <dd className="font-semibold text-gold-dark text-base">{formatPHP(selectedService.price)}</dd>
                </div>
                <div className="flex justify-between border-b border-gold/10 pb-2">
                  <dt className="text-ink-soft">Guest</dt>
                  <dd className="font-medium text-ink">{fullName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-soft">Contact</dt>
                  <dd className="font-medium text-ink">{email} &middot; {phone}</dd>
                </div>
              </dl>

              <div className="space-y-4">
                <h4 className="font-display text-lg font-semibold text-ink">Payment Method</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-all duration-200",
                      paymentMethod === "cash" ? "border-gold bg-gold/10 shadow-gold" : "border-ink/10 bg-white hover:border-gold/30"
                    )}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cash"
                      checked={paymentMethod === "cash"}
                      onChange={() => setPaymentMethod("cash")}
                      className="hidden"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-ink">Pay at the salon</p>
                      <p className="text-xs text-ink-soft mt-0.5">Settle with cash or card upon arrival</p>
                    </div>
                  </label>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-all duration-200",
                      paymentMethod === "qr_ph" ? "border-gold bg-gold/10 shadow-gold" : "border-ink/10 bg-white hover:border-gold/30"
                    )}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="qr_ph"
                      checked={paymentMethod === "qr_ph"}
                      onChange={() => setPaymentMethod("qr_ph")}
                      className="hidden"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-ink">QR Ph / E-Wallet</p>
                      <p className="text-xs text-ink-soft mt-0.5">Pay in advance via GCash or Maya</p>
                    </div>
                  </label>
                </div>

                {paymentMethod === "stripe" && (
                  <div className="mt-3 rounded-2xl bg-cream/70 p-4 text-xs text-ink-soft border border-gold/15 flex items-start gap-2.5">
                    <CreditCard className="h-4 w-4 text-gold-dark shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-ink">Stripe Test-Mode Sandbox</p>
                      <p className="mt-0.5 leading-relaxed">
                        You will be redirected to Stripe&rsquo;s secure test checkout. Test with standard card{" "}
                        <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-gold/20 font-bold text-ink">
                          4242 4242 4242 4242
                        </code>.
                      </p>
                    </div>
                  </div>
                )}

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
                          className="relative w-[240px] h-[240px] sm:w-[260px] sm:h-[260px] shrink-0 bg-white rounded-2xl flex items-center justify-center p-4 shadow-sm border border-ink/5 cursor-pointer hover:border-gold/40 transition-colors"
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
                          Download QR image
                        </a>
                      </div>

                      <div className="flex-1 space-y-2 text-center sm:text-left">
                        <p className="text-ink-soft text-sm">Account Name:</p>
                        <p className="font-bold text-lg text-ink leading-tight">{PAYMENT_CONFIG.accountName}</p>
                        <p className="text-2xl font-display font-semibold text-gold-dark mt-3">{formatPHP(selectedService.price)}</p>
                        <p className="text-xs text-ink-soft leading-relaxed">
                          Scan the code and send exact amount. Keep your reference number ready.
                        </p>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="paymentReference">Reference Number *</Label>
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

      {/* Accessible Error Feedback */}
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="mt-6 flex items-start gap-2.5 rounded-2xl border border-rose-dark/25 bg-rose/10 p-4 text-sm text-rose-dark"
        >
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="mt-8 flex items-center justify-between border-t border-gold/10 pt-6">
        <Button
          variant="ghost"
          onClick={goBack}
          disabled={step === 0 || isPending}
          className="gap-1.5 text-ink-soft hover:text-ink"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>

        {step < STEP_LABELS.length - 1 ? (
          <Button onClick={goNext} className="gap-1.5 shadow-gold">
            Continue <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleConfirm}
            disabled={isPending}
            className="gap-2 shadow-gold min-w-[180px]"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {paymentMethod === "stripe" ? "Connecting to Stripe..." : "Securing booking..."}
              </>
            ) : paymentMethod === "stripe" ? (
              "Pay with Card & Confirm"
            ) : (
              "Confirm Appointment"
            )}
          </Button>
        )}
      </div>

      {/* Enlarged QR Modal */}
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
              className="relative w-full max-w-lg bg-white p-6 rounded-3xl shadow-2xl flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="absolute top-4 right-4 text-ink-soft hover:text-ink bg-cream hover:bg-gold/10 hover:text-gold-dark rounded-full p-2 transition-colors"
                onClick={() => setEnlargedQr(null)}
                aria-label="Close QR view"
              >
                <X className="h-5 w-5" />
              </button>
              <img src={enlargedQr} alt="Enlarged QR Code" className="w-full h-auto max-h-[70vh] object-contain rounded-xl" />
              <p className="mt-4 font-semibold text-ink text-center">{PAYMENT_CONFIG.accountName}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
