"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAvailableSlots } from "@/lib/supabase/queries";

export async function fetchAvailableSlots(
  dateISO: string,
  staffId: string | null,
  durationMinutes: number
): Promise<string[]> {
  return getAvailableSlots(dateISO, staffId, durationMinutes);
}

export type BookingResult =
  | { ok: true; appointmentId: string }
  | { ok: false; error: string; slotTaken?: boolean };

export async function createAppointment(formData: FormData): Promise<BookingResult> {
  const serviceId = String(formData.get("serviceId") ?? "");
  const staffId = String(formData.get("staffId") ?? "") || null;
  const appointmentDate = String(formData.get("date") ?? "");
  const appointmentTime = String(formData.get("time") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!serviceId || !appointmentDate || !appointmentTime || !fullName || !phone || !email) {
    return { ok: false, error: "Please fill in every field before confirming." };
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      customer_id: authData.user?.id ?? null,
      service_id: serviceId,
      staff_id: staffId,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      full_name: fullName,
      phone,
      email,
      notes: notes || null,
    })
    .select("id")
    .single();

  if (error) {
    // Postgres unique_violation on (appointment_date, appointment_time, staff_id)
    // means someone else booked this exact slot a moment ago.
    if (error.code === "23505") {
      return {
        ok: false,
        error: "That time slot was just booked by someone else. Please pick another.",
        slotTaken: true,
      };
    }
    console.error("createAppointment:", error.message);
    return { ok: false, error: "Something went wrong saving your appointment. Please try again." };
  }

  revalidatePath("/account");
  revalidatePath("/admin");
  return { ok: true, appointmentId: data.id };
}
