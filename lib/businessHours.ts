/**
 * Business hours used to generate bookable time slots.
 * Index corresponds to JavaScript Date.getDay() (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 */
export const BUSINESS_HOURS: Record<number, { open: string; close: string } | null> = {
  0: { open: "11:00", close: "16:00" }, // Sunday
  1: { open: "09:00", close: "19:00" }, // Monday
  2: { open: "09:00", close: "19:00" }, // Tuesday
  3: { open: "09:00", close: "19:00" }, // Wednesday
  4: { open: "09:00", close: "19:00" }, // Thursday
  5: { open: "09:00", close: "19:00" }, // Friday
  6: { open: "09:00", close: "18:00" }, // Saturday
};

export function to12Hour(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

export function generateSlotsForDate(
  date: Date,
  durationMinutes: number,
  stepMinutes = 30
): string[] {
  const hours = BUSINESS_HOURS[date.getDay()];
  if (!hours) return [];

  const [openH, openM] = hours.open.split(":").map(Number);
  const [closeH, closeM] = hours.close.split(":").map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  const slots: string[] = [];
  for (let t = openMinutes; t + durationMinutes <= closeMinutes; t += stepMinutes) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    slots.push(to12Hour(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`));
  }
  return slots;
}

/**
 * Exact non-PII columns required for availability checks.
 * Under zero circumstances should customer names, emails, phones, or payment data be queried.
 */
export const BOOKED_SLOTS_COLUMNS = "appointment_time, appointment_date, staff_id" as const;

export interface BookedSlotRecord {
  appointment_time: string;
  appointment_date?: string;
  staff_id?: string | null;
  status?: string;
}

/**
 * Pure slot availability filtering function.
 * Given all generated slots for a date and a list of booked appointment records,
 * computes available slots by excluding active (non-cancelled) appointments.
 * If targetStaffId is specified, only bookings assigned to that staff member
 * (or unassigned bookings) block the slot.
 */
export function filterAvailableSlots(
  allSlots: string[],
  bookedAppointments: BookedSlotRecord[],
  targetStaffId?: string | null
): string[] {
  // Exclude cancelled appointments so cancelled bookings never block availability
  const activeBookings = bookedAppointments.filter(
    (b) => b.status !== "cancelled"
  );

  // Filter to bookings relevant to targetStaffId
  const relevantBookings = targetStaffId
    ? activeBookings.filter((b) => !b.staff_id || b.staff_id === targetStaffId)
    : activeBookings;

  const takenTimes = new Set(relevantBookings.map((b) => b.appointment_time));
  return allSlots.filter((slot) => !takenTimes.has(slot));
}
