"use server";

import { createClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getAvailableSlots } from "@/lib/supabase/queries";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Uses Service Role to bypass RLS for admin operations
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/**
 * Releases `pending_payment` slots older than 15 minutes.
 * Ensures the database stays clean and slots are freed up if a checkout is abandoned.
 */
export async function releaseExpiredSlots() {
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60000).toISOString();
  
  const { data: expired } = await supabaseAdmin.from("appointments").select("id, paymongo_deposit_checkout_id")
    .eq("status", "pending_payment").lt("created_at", fifteenMinsAgo);

  if (!expired || expired.length === 0) return;

  for (const appt of expired) {
    if (appt.paymongo_deposit_checkout_id) {
       // Hit PayMongo's expire endpoint first
       const res = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${appt.paymongo_deposit_checkout_id}/expire`, {
         method: "POST", headers: { "Authorization": `Basic ${btoa(process.env.PAYMONGO_SECRET_KEY! + ":")}` }
       });
       
       if (res.ok) {
         await supabaseAdmin.from("appointments").update({ status: "cancelled", admin_notes: "Payment expired (15m)" }).eq("id", appt.id);
       } else {
         // Could be already paid, expired, or invalid. Let's check status
         const getRes = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${appt.paymongo_deposit_checkout_id}`, {
           headers: { "Authorization": `Basic ${btoa(process.env.PAYMONGO_SECRET_KEY! + ":")}` }
         });
         const session = await getRes.json();
         const payments = session.data?.attributes?.payments || [];
         const isPaid = payments.some((p: any) => p.attributes?.status === "paid");
         const status = session.data?.attributes?.status;
         
         if (isPaid || status === "paid") {
             // Leave it, webhook will process it
             continue;
         } else if (status === "expired") {
             await supabaseAdmin.from("appointments").update({ status: "cancelled", admin_notes: "Payment expired (15m)" }).eq("id", appt.id);
         } else {
             console.error(`PayMongo expire failed for ${appt.paymongo_deposit_checkout_id}`, session);
         }
       }
    } else {
       await supabaseAdmin.from("appointments").update({ status: "cancelled", admin_notes: "Orphaned pending_payment" }).eq("id", appt.id);
    }
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
  | { ok: true; appointmentId: string }
  | { ok: false; error: string; slotTaken?: boolean };

export async function createAppointment(formData: FormData): Promise<BookingResult> {
  await releaseExpiredSlots();

  const serviceId = String(formData.get("serviceId") ?? "");
  const staffId = String(formData.get("staffId") ?? "") || null;
  const appointmentDate = String(formData.get("date") ?? "");
  const appointmentTime = String(formData.get("time") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const paymentMethod = String(formData.get("paymentMethod") ?? "");
  const rawReference = String(formData.get("paymentReference") ?? "");

  if (paymentMethod !== "cash" && paymentMethod !== "qr_ph") {
    return { ok: false, error: "Invalid payment method selected." };
  }

  let finalReference: string | null = null;
  if (paymentMethod === "qr_ph") {
    const trimmedRef = rawReference.trim().toUpperCase();
    if (!trimmedRef || trimmedRef.length < 6 || trimmedRef.length > 30 || !/^[A-Z0-9]+$/.test(trimmedRef)) {
      return { ok: false, error: "Please provide a valid 6-30 character alphanumeric reference number." };
    }
    finalReference = trimmedRef;
  }

  if (!serviceId || !appointmentDate || !appointmentTime || !fullName || !phone || !email) {
    return { ok: false, error: "Please fill in every field before confirming." };
  }

  const { userId } = await auth();
  let validCustomerId = null;
  if (userId) {
    // Validate if userId exists
    const supabase = await createClient();
    const { data: userRecord } = await supabase.from("users").select("id").eq("id", userId).single();
    if (userRecord) validCustomerId = userId;
  }

  // Fetch service details for price calculation
  const { data: serviceData } = await supabaseAdmin
    .from("services")
    .select("name, price")
    .eq("id", serviceId)
    .single();
    
  if (!serviceData) {
    return { ok: false, error: "Service not found." };
  }

  const deposit = Number(process.env.DEPOSIT_AMOUNT_PHP || 100);
  const expectedBalance = Math.max(0, serviceData.price - deposit);

  // 1. Insert row as confirmed using Service Role
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .insert({
      customer_id: validCustomerId,
      service_id: serviceId,
      staff_id: staffId,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      full_name: fullName,
      phone,
      email,
      notes: notes || null,
      status: "confirmed", // Bookings are immediately confirmed since there is no online payment
      payment_status: "pending",
      payment_method: paymentMethod,
      payment_reference: finalReference,
      expected_deposit: deposit,
      expected_balance: expectedBalance
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      if (error.message.includes("appointments_payment_reference_idx")) {
        return { ok: false, error: "That reference number was already used." };
      }
      return { ok: false, error: "That time slot was just booked by someone else. Please pick another.", slotTaken: true };
    }
    console.error("createAppointment:", error.message);
    return { ok: false, error: "Something went wrong reserving your slot." };
  }

  // Fetch service details for the email
  if (serviceData) {
    try {
      const { sendBookingConfirmationEmail } = await import("@/lib/email");
      await sendBookingConfirmationEmail({
        customerEmail: email,
        customerName: fullName,
        serviceName: serviceData.name,
        date: appointmentDate,
        time: appointmentTime,
        phone,
        price: serviceData.price,
        paymentMethod,
        paymentReference: finalReference,
      });
    } catch (emailErr) {
      console.error("Failed to trigger email:", emailErr);
    }
  }

  revalidatePath("/account");
  revalidatePath("/admin");
  return { ok: true, appointmentId: data.id };
}
