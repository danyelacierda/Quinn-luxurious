"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { auth } from "@clerk/nextjs/server";
import { canManageAppointment } from "@/lib/auth";
import { validateManilaBookingTime } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export async function cancelAppointment(appointmentId: string): Promise<{ error: string | null }> {
  const { userId } = await auth();
  if (!userId) {
    return { error: "You must be signed in to cancel an appointment." };
  }

  const supabase = createAdminClient();

  // 1. Fetch appointment record to verify existence and ownership
  const { data: appt, error: fetchErr } = await supabase
    .from("appointments")
    .select("id, customer_id, status")
    .eq("id", appointmentId)
    .maybeSingle();

  if (fetchErr || !appt) {
    return { error: "Appointment not found." };
  }

  if (appt.status === "cancelled") {
    return { error: "This appointment is already cancelled." };
  }

  // 2. IDOR Protection: Verify owner or staff/admin
  const allowed = await canManageAppointment(appt.customer_id);
  if (!allowed) {
    return { error: "Forbidden: You are not authorized to cancel this appointment." };
  }

  // 3. Perform cancellation
  const { error } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointmentId);

  if (error) {
    return { error: "Couldn't cancel that appointment. Please try again." };
  }

  revalidatePath("/account");
  revalidatePath("/admin");
  return { error: null };
}

export async function rescheduleAppointment(
  appointmentId: string,
  newDate: string,
  newTime: string
): Promise<{ error: string | null; slotTaken?: boolean }> {
  const { userId } = await auth();
  if (!userId) {
    return { error: "You must be signed in to reschedule an appointment." };
  }

  // 1. Validate new date and time against Asia/Manila calendar rules
  const dateValidation = validateManilaBookingTime(newDate, newTime);
  if (!dateValidation.valid) {
    return { error: dateValidation.error || "Invalid date or time." };
  }

  const supabase = createAdminClient();

  // 2. Fetch appointment to verify existence and ownership
  const { data: appt, error: fetchErr } = await supabase
    .from("appointments")
    .select("id, customer_id, status")
    .eq("id", appointmentId)
    .maybeSingle();

  if (fetchErr || !appt) {
    return { error: "Appointment not found." };
  }

  if (appt.status === "cancelled") {
    return { error: "Cancelled appointments cannot be rescheduled. Please book a new appointment." };
  }

  // 3. IDOR Protection: Verify owner or staff/admin
  const allowed = await canManageAppointment(appt.customer_id);
  if (!allowed) {
    return { error: "Forbidden: You are not authorized to reschedule this appointment." };
  }

  // 4. Perform rescheduling
  const { error } = await supabase
    .from("appointments")
    .update({
      appointment_date: dateValidation.normalizedDate || newDate,
      appointment_time: dateValidation.normalizedTime || newTime,
    })
    .eq("id", appointmentId);

  if (error) {
    if (error.code === "23505") {
      return { error: "That time slot is already booked. Please pick another.", slotTaken: true };
    }
    return { error: "Couldn't reschedule that appointment. Please try again." };
  }

  revalidatePath("/account");
  revalidatePath("/admin");
  return { error: null };
}
