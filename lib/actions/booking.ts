"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getAvailableSlots } from "@/lib/supabase/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidEmail, validateManilaBookingTime } from "@/lib/validation";
import { getStripeClient, getAppBaseUrl } from "@/lib/stripe";

/**
 * Releases `pending_payment` slots older than 15 minutes.
 * Ensures the database stays clean and slots are freed up if a checkout is abandoned.
 */
export async function releaseExpiredSlots() {
  try {
    const supabaseAdmin = createAdminClient();
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60000).toISOString();

    const { data: expired, error } = await supabaseAdmin
      .from("appointments")
      .select("id")
      .eq("status", "pending_payment")
      .lt("created_at", fifteenMinsAgo);

    if (error || !expired || expired.length === 0) return;

    for (const appt of expired) {
      await supabaseAdmin
        .from("appointments")
        .update({ status: "cancelled", payment_status: "expired" })
        .eq("id", appt.id);
    }
  } catch (err) {
    console.error("releaseExpiredSlots error:", err);
  }
}

export async function fetchAvailableSlots(
  dateISO: string,
  staffId: string | null,
  durationMinutes: number
): Promise<string[]> {
  await releaseExpiredSlots();
  return getAvailableSlots(dateISO, staffId, durationMinutes);
}

export type BookingResult =
  | { ok: true; appointmentId: string; checkoutUrl?: string | null }
  | { ok: false; error: string; slotTaken?: boolean };

export async function createAppointment(formData: FormData): Promise<BookingResult> {
  await releaseExpiredSlots();

  // 1. Spam honeypot protection
  const honeypot = String(formData.get("website") ?? "").trim();
  if (honeypot) {
    return { ok: false, error: "Spam submission detected." };
  }

  const serviceId = String(formData.get("serviceId") ?? "").trim();
  const staffId = String(formData.get("staffId") ?? "").trim() || null;
  const appointmentDate = String(formData.get("date") ?? "").trim();
  const appointmentTime = String(formData.get("time") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const paymentMethod = String(formData.get("paymentMethod") ?? "").trim();
  const rawReference = String(formData.get("paymentReference") ?? "").trim();

  // 2. Required fields verification
  if (!serviceId || !appointmentDate || !appointmentTime || !fullName || !phone || !email) {
    return { ok: false, error: "Please fill in every required field before confirming." };
  }

  // 3. Field length constraints
  if (fullName.length > 100) {
    return { ok: false, error: "Full name must be under 100 characters." };
  }
  if (email.length > 255) {
    return { ok: false, error: "Email must be under 255 characters." };
  }
  if (phone.length > 30) {
    return { ok: false, error: "Phone number must be under 30 characters." };
  }
  if (notes.length > 500) {
    return { ok: false, error: "Notes must be under 500 characters." };
  }

  // 4. Strict Email validation
  if (!isValidEmail(email)) {
    return { ok: false, error: "Please provide a valid email address (e.g. name@example.com)." };
  }

  // 5. Asia/Manila date and time validation
  const timeValidation = validateManilaBookingTime(appointmentDate, appointmentTime);
  if (!timeValidation.valid) {
    return { ok: false, error: timeValidation.error || "Invalid appointment date or time." };
  }

  // 6. Payment method verification: Supports Cash, QR Ph, and Stripe Test Mode
  if (paymentMethod !== "cash" && paymentMethod !== "qr_ph" && paymentMethod !== "stripe") {
    return { ok: false, error: "Invalid payment method selected." };
  }

  let finalReference: string | null = null;
  if (paymentMethod === "qr_ph") {
    const trimmedRef = rawReference.toUpperCase();
    if (!trimmedRef || trimmedRef.length < 6 || trimmedRef.length > 30 || !/^[A-Z0-9]+$/.test(trimmedRef)) {
      return { ok: false, error: "Please provide a valid 6-30 character alphanumeric reference number for QR Ph." };
    }
    finalReference = trimmedRef;
  }

  const supabaseAdmin = createAdminClient();

  // 7. Verify service exists and is active.
  // AUTHORITATIVE PRICING: Service price is fetched directly from database, never trusted from client!
  const { data: serviceData, error: srvErr } = await supabaseAdmin
    .from("services")
    .select("id, name, price, is_active, duration_minutes")
    .eq("id", serviceId)
    .maybeSingle();

  if (srvErr || !serviceData || !serviceData.is_active) {
    return { ok: false, error: "The selected service is no longer available." };
  }

  // 8. If staff selected, verify staff exists and is active
  if (staffId) {
    const { data: staffData, error: stfErr } = await supabaseAdmin
      .from("staff")
      .select("id, is_active")
      .eq("id", staffId)
      .maybeSingle();

    if (stfErr || !staffData || !staffData.is_active) {
      return { ok: false, error: "The selected staff artist is no longer available." };
    }
  }

  // 9. Pre-insert conflict check for active bookings
  let conflictQuery = supabaseAdmin
    .from("appointments")
    .select("id")
    .eq("appointment_date", timeValidation.normalizedDate || appointmentDate)
    .eq("appointment_time", timeValidation.normalizedTime || appointmentTime)
    .in("status", ["pending", "pending_payment", "confirmed", "completed"]);

  if (staffId) {
    conflictQuery = conflictQuery.eq("staff_id", staffId);
  }

  const { data: existingSlots } = await conflictQuery;
  if (existingSlots && existingSlots.length > 0) {
    return {
      ok: false,
      error: "That time slot was just booked by someone else. Please pick another.",
      slotTaken: true,
    };
  }

  // 10. Link customer ID if user is authenticated
  const { userId } = await auth();
  let validCustomerId: string | null = null;
  if (userId) {
    const { data: userRecord } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (userRecord) {
      validCustomerId = userId;
    }
  }

  // 11. Initial status assignment:
  // For Stripe, booking starts in 'pending_payment' until webhook confirms verified payment.
  // For Cash or QR Ph, booking starts in 'confirmed'.
  const initialStatus = paymentMethod === "stripe" ? "pending_payment" : "confirmed";
  const initialPaymentStatus = "pending";

  const { data, error } = await supabaseAdmin
    .from("appointments")
    .insert({
      customer_id: validCustomerId,
      service_id: serviceId,
      staff_id: staffId,
      appointment_date: timeValidation.normalizedDate || appointmentDate,
      appointment_time: timeValidation.normalizedTime || appointmentTime,
      full_name: fullName,
      phone,
      email,
      notes: notes || null,
      status: initialStatus,
      payment_status: initialPaymentStatus,
      payment_method: paymentMethod,
      payment_reference: finalReference,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createAppointment error:", error?.message);
    if (error && (error as { code?: string }).code === "23505") {
      return {
        ok: false,
        error: "That time slot is already booked. Please pick another.",
        slotTaken: true,
      };
    }
    return { ok: false, error: "Failed to book appointment. Please try again." };
  }

  // 12. If Stripe test payment was selected, create Stripe Checkout Session
  if (paymentMethod === "stripe") {
    try {
      const stripe = getStripeClient();
      const baseUrl = getAppBaseUrl();

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        
        line_items: [
          {
            price_data: {
              currency: "php",
              unit_amount: Math.round(serviceData.price * 100),
              product_data: {
                name: serviceData.name,
                description: `Quinn Luxurious Salon Appointment (${timeValidation.normalizedDate || appointmentDate} at ${timeValidation.normalizedTime || appointmentTime})`,
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          appointment_id: data.id,
          service_id: serviceData.id,
          customer_id: validCustomerId || "",
          customer_email: email,
        },
        client_reference_id: data.id,
        customer_email: email,
        success_url: `${baseUrl}/appointment/success?session_id={CHECKOUT_SESSION_ID}&appointment_id=${data.id}`,
        cancel_url: `${baseUrl}/appointment/cancelled?appointment_id=${data.id}`,
      });

      // Save stripe session id and payment reference on appointment (with graceful fallback)
      const { error: sessionUpdateErr } = await supabaseAdmin
        .from("appointments")
        .update({
          stripe_session_id: session.id,
          payment_reference: session.id,
        })
        .eq("id", data.id);

      if (sessionUpdateErr) {
        await supabaseAdmin
          .from("appointments")
          .update({
            payment_reference: session.id,
          })
          .eq("id", data.id);
      }

      revalidatePath("/account");
      return { ok: true, appointmentId: data.id, checkoutUrl: session.url };
    } catch (stripeErr: any) {
      console.error("Stripe Checkout creation error:", stripeErr?.message);
      // Clean up the created appointment to prevent dangling pending slots
      await supabaseAdmin.from("appointments").delete().eq("id", data.id);
      return {
        ok: false,
        error: `Payment initialization failed: ${stripeErr?.message || "Please check Stripe configuration."}`,
      };
    }
  }

  // 13. Send confirmation email for immediate bookings (Cash / QR Ph)
  try {
    const { sendBookingConfirmationEmail } = await import("@/lib/email");
    await sendBookingConfirmationEmail({
      customerEmail: email,
      customerName: fullName,
      serviceName: serviceData.name,
      date: timeValidation.normalizedDate || appointmentDate,
      time: timeValidation.normalizedTime || appointmentTime,
      phone,
      price: serviceData.price,
      paymentMethod,
      paymentReference: finalReference,
    });
  } catch (emailErr) {
    console.error("Failed to send booking confirmation email:", emailErr);
  }

  revalidatePath("/account");
  return { ok: true, appointmentId: data.id };
}
