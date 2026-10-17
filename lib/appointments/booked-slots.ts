import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { BOOKED_SLOTS_COLUMNS, type BookedSlotRecord } from "@/lib/businessHours";

/**
 * Fetches booked appointment slots for a given date using the server admin client.
 *
 * WHAT: Reads booked appointment times (appointment_time, appointment_date, staff_id) for a date.
 * WHY: RLS hides appointment rows from unauthenticated guests (auth.uid() is null). The admin
 *      client is required server-side so guests see taken slots. Selects ONLY appointment_time,
 *      appointment_date, and staff_id to ensure zero PII exposure.
 * WHO: Public booking availability check (anyone can trigger via fetchAvailableSlots Server Action),
 *      returning only slot time strings with no customer data.
 */
export async function getBookedSlots(
  dateISO: string,
  staffId?: string | null
): Promise<BookedSlotRecord[]> {
  // WHAT: Reads booked appointment times for a date (appointment_time, appointment_date, staff_id).
  // WHY: Bypasses RLS so anonymous visitors can see taken slots. Normal client returns 0 rows for guests.
  // WHO: Anyone (public booking flow via fetchAvailableSlots), but returns only time strings with zero PII.
  const supabase = createAdminClient();

  let query = supabase
    .from("appointments")
    .select(BOOKED_SLOTS_COLUMNS)
    .eq("appointment_date", dateISO)
    .neq("status", "cancelled");

  if (staffId) {
    query = query.eq("staff_id", staffId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("getBookedSlots error:", error.message);
    return [];
  }

  return (data ?? []) as BookedSlotRecord[];
}
