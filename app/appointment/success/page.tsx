import Link from "next/link";
import { Check, Clock, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/shared/PageHero";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe";
import { formatPHP } from "@/lib/format";
import { isAuthorizedToManageAppointment, resolveUserRole } from "@/lib/authPolicy";
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
  const supabaseAdmin = createAdminClient();

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
      // 1. Customer authorization check:
      // If the appointment is linked to a customer, enforce that the viewer is the owner or staff/admin
      if (appt.customer_id) {
        let isAuthorized = false;
        if (userId) {
          if (appt.customer_id === userId) {
            isAuthorized = true;
          } else {
            // Check if admin or staff
            const { data: userRec } = await supabaseAdmin
              .from("users")
              .select("role, email")
              .eq("id", userId)
              .maybeSingle();

            if (userRec?.role === "admin" || userRec?.role === "staff") {
              isAuthorized = true;
            }
          }
        }

        if (!isAuthorized) {
          unauthorizedAccess = true;
        }
      }

      if (!unauthorizedAccess) {
        appointment = appt;
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

        // 2. Safe server-to-server fallback check:
        // NEVER trust redirect params alone. Verify all session attributes rigorously before updating.
        if (
          !isVerifiedPaid &&
          sessionId &&
          sessionId.startsWith("cs_test_") &&
          service
        ) {
          try {
            const stripe = getStripeClient();
            const session = await stripe.checkout.sessions.retrieve(sessionId);

            const expectedAmountCentavos = Math.round(service.price * 100);
            const sessionMatchesAppt =
              (session.metadata?.appointment_id === appt.id ||
                session.client_reference_id === appt.id) &&
              (!appt.stripe_session_id || appt.stripe_session_id === session.id);

            const amountMatches = session.amount_total === expectedAmountCentavos;
            const currencyMatches = session.currency?.toLowerCase() === "php";
            const isPaidPaymentMode =
              session.mode === "payment" && session.payment_status === "paid";

            if (
              sessionMatchesAppt &&
              amountMatches &&
              currencyMatches &&
              isPaidPaymentMode
            ) {
              // Atomic update with status guard
              const { data: updatedRows, error: updateErr } = await supabaseAdmin
                .from("appointments")
                .update({
                  status: "confirmed",
                  payment_status: "fully_paid",
                  payment_method: "stripe",
                  payment_reference: session.payment_intent
                    ? String(session.payment_intent)
                    : session.id,
                  stripe_session_id: session.id,
                  stripe_payment_intent_id: session.payment_intent
                    ? String(session.payment_intent)
                    : null,
                })
                .eq("id", appointmentId)
                .neq("payment_status", "fully_paid")
                .select("id");

              if ((updateErr as { code?: string })?.code === "23505") {
                console.error(
                  `[successPage] slot conflict (23505), flagging for refund, appointment_id: ${appointmentId}`
                );
                slotConflict = true;
                const { error: refundErr } = await supabaseAdmin
                  .from("appointments")
                  .update({ needs_refund: true })
                  .eq("id", appointmentId);

                if (refundErr) {
                  console.error(
                    `[successPage] table: appointments, operation: update (needs_refund), appointment_id: ${appointmentId}, error: ${refundErr.message}`
                  );
                }
              } else if (updatedRows && updatedRows.length > 0) {
                isVerifiedPaid = true;
              } else if (appt.payment_status === "fully_paid") {
                isVerifiedPaid = true;
              }
            } else {
              console.warn(
                "Stripe session validation failed on success page fallback:",
                { sessionMatchesAppt, amountMatches, currencyMatches, isPaidPaymentMode }
              );
            }
          } catch (syncErr) {
            console.error("Error retrieving Stripe session for success page:", syncErr);
          }
        }
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
