import Link from "next/link";
import { Check, Clock, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/shared/PageHero";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe";
import { formatPHP } from "@/lib/format";
import { getCurrentUserRole } from "@/lib/auth";
import { isAuthorizedToViewSuccessPage } from "@/lib/authPolicy";
import { markPaidAndNotify } from "@/lib/payments/markPaidAndNotify";
import type { AppointmentRow, ServiceRow } from "@/lib/supabase/queries";

type PageProps = {
  searchParams?: Promise<{
    session_id?: string;
    appointment_id?: string;
  }>;
};

export default async function AppointmentSuccessPage({ searchParams }: PageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const appointmentId = resolvedParams?.appointment_id;
  const sessionId = resolvedParams?.session_id;

  const { userId } = await auth();
  const callerRole = await getCurrentUserRole();
  const supabaseAdmin = createAdminClient();

  // If user is authenticated, resolve role checking both Clerk claims and Supabase users table
  let effectiveRole = callerRole;
  if (userId && effectiveRole !== "admin" && effectiveRole !== "staff") {
    const { data: userRec } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (userRec?.role === "admin" || userRec?.role === "staff") {
      effectiveRole = userRec.role;
    }
  }

  let appointment: AppointmentRow | null = null;
  let service: ServiceRow | null = null;
  let isVerifiedPaid = false;
  let slotConflict = false;
  let unauthorizedAccess = false;

  if (appointmentId) {
    const { data: appt } = await supabaseAdmin
      .from("appointments")
      .select("*")
      .eq("id", appointmentId)
      .maybeSingle();

    if (appt) {
      if (appt.service_id) {
        const { data: srv } = await supabaseAdmin
          .from("services")
          .select("*")
          .eq("id", appt.service_id)
          .maybeSingle();
        service = srv;
      }

      isVerifiedPaid = appt.payment_status === "fully_paid";
      slotConflict = Boolean(appt.needs_refund);

      let verifiedStripeSessionMatches = false;

      // Safe Stripe Session Verification:
      // Holds true if the session is cryptographically matched to this appointment and verified paid
      if (sessionId && sessionId.startsWith("cs_")) {
        // Fast-path: Appointment already marked fully_paid by webhook and session ID matches stored session
        if (appt.stripe_session_id === sessionId && isVerifiedPaid) {
          verifiedStripeSessionMatches = true;
        } else {
          // Server-to-server fallback check with Stripe API:
          // Strictly verify all attributes: appointment reference, amount, currency, and paid status
          try {
            const stripe = getStripeClient();
            const session = await stripe.checkout.sessions.retrieve(sessionId);

            const expectedAmountCentavos = service ? Math.round(service.price * 100) : 0;
            const sessionMatchesAppt =
              (session.metadata?.appointment_id === appt.id ||
                session.client_reference_id === appt.id) &&
              (!appt.stripe_session_id || appt.stripe_session_id === session.id);

            const amountMatches = service ? session.amount_total === expectedAmountCentavos : true;
            const currencyMatches = session.currency?.toLowerCase() === "php";
            const isPaidPaymentMode =
              session.mode === "payment" && session.payment_status === "paid";

            if (
              sessionMatchesAppt &&
              amountMatches &&
              currencyMatches &&
              isPaidPaymentMode
            ) {
              verifiedStripeSessionMatches = true;

              if (!isVerifiedPaid && service) {
                // Atomic guarded update & notification via shared helper
                const result = await markPaidAndNotify({
                  appointmentId: appt.id,
                  sessionId: session.id,
                  paymentIntentId: session.payment_intent ? String(session.payment_intent) : null,
                  customerEmail: appt.email,
                  customerName: appt.full_name,
                  serviceName: service.name,
                  date: appt.appointment_date,
                  time: appt.appointment_time,
                  phone: appt.phone,
                  price: service.price,
                  supabase: supabaseAdmin,
                  runEmailWithAfter: true,
                });

                if (result.slotConflict) {
                  slotConflict = true;
                } else if (result.updated || result.alreadyPaid || appt.payment_status === "fully_paid") {
                  isVerifiedPaid = true;
                }
              }
            } else {
              console.warn(
                "[AppointmentSuccess] Stripe session validation failed:",
                { sessionMatchesAppt, amountMatches, currencyMatches, isPaidPaymentMode }
              );
            }
          } catch (syncErr: any) {
            console.error("[AppointmentSuccess] Error retrieving Stripe session:", syncErr?.message);
          }
        }
      }

      // Check authorization via pure policy function
      const authResult = isAuthorizedToViewSuccessPage({
        caller: { userId: userId ?? null, role: effectiveRole },
        appointment: { id: appt.id, customer_id: appt.customer_id },
        verifiedStripeSessionMatches,
      });

      // Safe server-side diagnostic logging (no secrets, tokens, or PII)
      console.info("[AppointmentSuccessAuth]", {
        appointmentId: appt.id,
        authOutcome: authResult.isAuthorized ? "authorized" : "denied",
        authReason: authResult.reason,
        hasUserId: Boolean(userId),
        userRole: effectiveRole ?? "unauthenticated",
        hasAppointmentCustomerId: Boolean(appt.customer_id),
        hasSessionId: Boolean(sessionId),
        isVerifiedPaid,
      });

      if (!authResult.isAuthorized) {
        unauthorizedAccess = true;
      } else {
        appointment = appt;
      }
    }
  }

  if (unauthorizedAccess) {
    return (
      <section className="section-padding bg-paper">
        <div className="container flex justify-center">
          <Card className="max-w-md p-8 text-center rounded-3xl border-rose-dark/25 shadow-card">
            <ShieldAlert className="mx-auto h-12 w-12 text-rose-dark" />
            <h2 className="mt-4 font-display text-2xl font-semibold text-ink">
              Access Restricted
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              You do not have authorization to view this customer reservation.
            </p>
            <Button asChild className="mt-6 shadow-gold">
              <Link href="/account">Go to My Account</Link>
            </Button>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <>
      <PageHero
        eyebrow="Booking Status"
        title={slotConflict ? "Payment Received" : isVerifiedPaid ? "Appointment Confirmed" : "Booking Received"}
        description={
          slotConflict
            ? "Your payment was received. Our team will contact you regarding scheduling."
            : "Thank you for reserving with Quinn Luxurious. Here are your booking details."
        }
      />

      <section className="section-padding bg-paper">
        <div className="container flex justify-center">
          <div className="w-full max-w-xl">
            <Card className="p-8 text-center sm:p-10 shadow-card rounded-3xl border-gold/20">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold/15 text-gold-dark ring-4 ring-gold/20">
                {slotConflict ? (
                  <Clock className="h-8 w-8 stroke-[2.5] text-amber-600" />
                ) : isVerifiedPaid ? (
                  <Check className="h-8 w-8 stroke-[2.5]" />
                ) : (
                  <Clock className="h-8 w-8 stroke-[2.5]" />
                )}
              </span>

              <h2 className="mt-6 font-display text-3xl font-semibold text-ink">
                {slotConflict
                  ? "Payment Received"
                  : isVerifiedPaid
                  ? "Payment Confirmed!"
                  : "Payment Processing"}
              </h2>

              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                {slotConflict
                  ? "Your payment was received successfully! However, your previously selected time slot was taken while payment was in progress. Our salon team will contact you directly to reschedule your booking or provide a full refund."
                  : isVerifiedPaid
                  ? "Your Stripe test payment was verified successfully and your appointment slot is secured."
                  : "We are awaiting final webhook confirmation from Stripe. You will receive an email once the transaction is complete."}
              </p>

              {appointment && (
                <div className="mt-6 rounded-2xl bg-cream/70 p-5 text-left text-sm space-y-2.5 border border-gold/15">
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Treatment:</span>
                    <strong className="text-ink">{service?.name || "Signature Service"}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Date:</span>
                    <strong className="text-ink">
                      {new Date(`${appointment.appointment_date}T00:00:00`).toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Time:</span>
                    <strong className="text-ink">{appointment.appointment_time}</strong>
                  </div>
                  {service?.price !== undefined && (
                    <div className="flex justify-between border-t border-gold/10 pt-2">
                      <span className="text-ink-soft">Amount:</span>
                      <strong className="text-gold-dark font-display text-base">
                        {formatPHP(service.price)}
                      </strong>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Payment Status:</span>
                    <span className="font-semibold text-gold-dark">
                      {slotConflict
                        ? "Payment Received — Salon Contacting (Refund / Reschedule)"
                        : isVerifiedPaid
                        ? "Paid in full (Stripe Test)"
                        : "Awaiting Confirmation"}
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button asChild className="w-full sm:w-auto shadow-gold">
                  <Link href="/account">View My Appointments</Link>
                </Button>
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link href="/services">Browse Services</Link>
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>
    </>
  );
}
