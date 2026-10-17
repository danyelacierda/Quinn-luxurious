import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { constructWebhookEvent } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured.");
    return NextResponse.json(
      { error: "Webhook secret is not configured on the server." },
      { status: 500 }
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header." },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = constructWebhookEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${err.message}` },
      { status: 400 }
    );
  }

  // Strict safety check: Never process live-mode events in test environment
  if (event.livemode === true) {
    console.error("SAFETY VIOLATION: Live-mode event received on test webhook endpoint.");
    return NextResponse.json(
      { error: "Live-mode events are strictly rejected in test environment." },
      { status: 400 }
    );
  }

  const supabaseAdmin = createAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // 1. Verify session mode and payment status
        if (session.mode !== "payment") {
          console.warn(`Ignored non-payment session mode: ${session.mode}`);
          break;
        }

        if (session.payment_status !== "paid") {
          console.warn(
            `Checkout session ${session.id} completed without paid status: ${session.payment_status}`
          );
          break;
        }

        const appointmentId =
          session.metadata?.appointment_id || session.client_reference_id;

        if (!appointmentId) {
          console.error("No appointment ID found in session metadata or client_reference_id.");
          return NextResponse.json(
            { error: "Missing appointment reference in session metadata." },
            { status: 400 }
          );
        }

        // 2. Fetch existing appointment to verify stored session and service
        const { data: existingAppt, error: fetchErr } = await supabaseAdmin
          .from("appointments")
          .select("id, status, payment_status, full_name, email, appointment_date, appointment_time, service_id, stripe_session_id")
          .eq("id", appointmentId)
          .maybeSingle();

        if (fetchErr || !existingAppt) {
          console.error(`Appointment ${appointmentId} not found in database.`);
          return NextResponse.json(
            { error: "Associated appointment not found." },
            { status: 404 }
          );
        }

        // 3. Stored session matching: ensure session ID matches stored session on appointment
        if (existingAppt.stripe_session_id && existingAppt.stripe_session_id !== session.id) {
          console.error(
            `Session mismatch: expected ${existingAppt.stripe_session_id}, got ${session.id}`
          );
          return NextResponse.json(
            { error: "Session ID does not match stored appointment session." },
            { status: 400 }
          );
        }

        // 4. Expected amount and currency verification
        const { data: srv, error: srvErr } = await supabaseAdmin
          .from("services")
          .select("name, price")
          .eq("id", existingAppt.service_id)
          .maybeSingle();

        if (srvErr || !srv) {
          console.error(`Service ${existingAppt.service_id} not found for appointment ${appointmentId}.`);
          return NextResponse.json(
            { error: "Associated service record not found." },
            { status: 400 }
          );
        }

        const expectedAmountCentavos = Math.round(srv.price * 100);
        if (session.amount_total !== expectedAmountCentavos) {
          console.error(
            `Amount mismatch: expected ${expectedAmountCentavos} centavos, received ${session.amount_total}`
          );
          return NextResponse.json(
            { error: "Session amount does not match authoritative service price." },
            { status: 400 }
          );
        }

        if (session.currency?.toLowerCase() !== "php") {
          console.error(`Currency mismatch: expected php, received ${session.currency}`);
          return NextResponse.json(
            { error: "Invalid currency received." },
            { status: 400 }
          );
        }

        // 5. Atomic concurrency guard:
        // Update ONLY if payment_status is not already 'fully_paid'.
        // If two webhook requests arrive simultaneously, only ONE will update the row.
        const paymentIntentId = session.payment_intent
          ? String(session.payment_intent)
          : null;

        const { data: updatedRows, error: updateErr } = await supabaseAdmin
          .from("appointments")
          .update({
            status: "confirmed",
            payment_status: "fully_paid",
            payment_method: "stripe",
            payment_reference: paymentIntentId || session.id,
            stripe_session_id: session.id,
            stripe_payment_intent_id: paymentIntentId,
          })
          .eq("id", appointmentId)
          .neq("payment_status", "fully_paid")
          .select("id");

        if (updateErr) {
          if ((updateErr as { code?: string }).code === "23505") {
            console.error(
              `[stripeWebhook:checkout.session.completed] slot conflict (23505), flagging for refund, appointment_id: ${appointmentId}`
            );
            const { error: refundFlagErr } = await supabaseAdmin
              .from("appointments")
              .update({ needs_refund: true })
              .eq("id", appointmentId);

            if (refundFlagErr) {
              console.error(
                `[stripeWebhook:checkout.session.completed] table: appointments, operation: update (needs_refund), appointment_id: ${appointmentId}, error: ${refundFlagErr.message}`
              );
            }

            return NextResponse.json({
              received: true,
              slotConflict: true,
              needs_refund: true,
              message: "Time slot conflict on paid booking: flagged for refund.",
            });
          }

          console.error("Database update failed on webhook:", updateErr.message);
          // Return 500 so Stripe automatically retries the delivery
          return NextResponse.json(
            { error: "Database update failed." },
            { status: 500 }
          );
        }

        // If 0 rows updated, it was already marked fully_paid concurrently
        if (!updatedRows || updatedRows.length === 0) {
          return NextResponse.json({
            received: true,
            idempotent: true,
            message: "Appointment was already confirmed and paid.",
          });
        }

        // 6. Send confirmation email only on the first atomic update
        try {
          const { sendBookingConfirmationEmail } = await import("@/lib/email");
          await sendBookingConfirmationEmail({
            customerEmail: existingAppt.email,
            customerName: existingAppt.full_name,
            serviceName: srv.name || "Signature Service",
            date: existingAppt.appointment_date,
            time: existingAppt.appointment_time,
            price: srv.price,
            paymentMethod: "stripe",
            paymentReference: paymentIntentId || session.id,
          });
        } catch (emailErr) {
          console.error("Failed to send Stripe booking confirmation email:", emailErr);
        }

        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const appointmentId =
          session.metadata?.appointment_id || session.client_reference_id;

        if (appointmentId) {
          // Free slot only if the appointment is still pending_payment and matches session.id.
          // Never cancel if it was already confirmed or paid.
          const { error: expireErr } = await supabaseAdmin
            .from("appointments")
            .update({
              status: "cancelled",
              payment_status: "expired",
            })
            .eq("id", appointmentId)
            .eq("stripe_session_id", session.id)
            .eq("status", "pending_payment")
            .neq("payment_status", "fully_paid");

          if (expireErr) {
            console.error(
              `[stripeWebhook:checkout.session.expired] table: appointments, operation: update, appointment_id: ${appointmentId}, error: ${expireErr.message}`
            );
          }
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const appointmentId =
          paymentIntent.metadata?.appointment_id || paymentIntent.id;

        // Never overwrite a confirmed or fully paid booking with failed status.
        const { error: failErr } = await supabaseAdmin
          .from("appointments")
          .update({
            payment_status: "failed",
          })
          .eq("stripe_payment_intent_id", paymentIntent.id)
          .neq("status", "confirmed")
          .neq("payment_status", "fully_paid");

        if (failErr) {
          console.error(
            `[stripeWebhook:payment_intent.payment_failed] table: appointments, operation: update, appointment_id: ${appointmentId}, error: ${failErr.message}`
          );
        }
        break;
      }

      default:
        // Cleanly acknowledge unhandled event types
        break;
    }

    return NextResponse.json({ received: true });
  } catch (processErr: any) {
    console.error("Webhook processing error:", processErr.message);
    return NextResponse.json(
      { error: "Webhook event processing error." },
      { status: 500 }
    );
  }
}
