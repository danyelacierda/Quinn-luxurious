"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function cancelAppointment(appointmentId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
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
  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({ appointment_date: newDate, appointment_time: newTime })
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
