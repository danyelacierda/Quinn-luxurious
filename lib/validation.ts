/**
 * Shared validation utilities for Quinn Luxurious.
 * Enforces RFC-compliant email regex and Asia/Manila (UTC+8) booking calendar/time validation.
 */

export const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function isValidEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 255) return false;
  // Disallow consecutive dots
  if (trimmed.includes("..")) return false;
  // Disallow leading or trailing dot in local part
  if (trimmed.startsWith(".") || trimmed.endsWith(".")) return false;
  return EMAIL_REGEX.test(trimmed);
}

export interface ManilaValidationResult {
  valid: boolean;
  error?: string;
  normalizedDate?: string;
  normalizedTime?: string;
}

/**
 * Validates appointment date and time against Asia/Manila timezone (UTC+8).
 * Supports 24-hour ('09:00', '14:00') and 12-hour ('9:00 AM', '2:00 PM') formats.
 *
 * @param appointmentDate 'YYYY-MM-DD'
 * @param appointmentTime 'HH:mm' or 'h:mm A'
 * @param referenceNow Optional Date for deterministic testing (defaults to new Date())
 */
export function validateManilaBookingTime(
  appointmentDate: string,
  appointmentTime: string,
  referenceNow: Date = new Date()
): ManilaValidationResult {
  if (!appointmentDate || typeof appointmentDate !== "string") {
    return { valid: false, error: "Appointment date is required." };
  }
  if (!appointmentTime || typeof appointmentTime !== "string") {
    return { valid: false, error: "Appointment time is required." };
  }

  // 1. Strict YYYY-MM-DD calendar verification
  const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  if (!dateRegex.test(appointmentDate.trim())) {
    return { valid: false, error: "Invalid date format. Expected YYYY-MM-DD." };
  }

  const [year, month, day] = appointmentDate.trim().split("-").map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    return { valid: false, error: "Date does not exist on the calendar." };
  }

  // 2. Parse appointment time (24h or 12h)
  const cleanTime = appointmentTime.trim();
  let hour24: number;
  let minute: number;

  const match24 = cleanTime.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  const match12 = cleanTime.match(/^(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)$/i);

  if (match24) {
    hour24 = parseInt(match24[1], 10);
    minute = parseInt(match24[2], 10);
  } else if (match12) {
    let h = parseInt(match12[1], 10);
    const m = parseInt(match12[2], 10);
    const meridian = match12[3].toUpperCase();
    if (meridian === "PM" && h < 12) h += 12;
    if (meridian === "AM" && h === 12) h = 0;
    hour24 = h;
    minute = m;
  } else {
    return {
      valid: false,
      error: `Invalid time format "${appointmentTime}". Expected HH:mm (e.g. 09:00, 14:00) or h:mm A (e.g. 9:00 AM, 2:00 PM).`,
    };
  }

  // 3. Extract exact current Manila date and time parts (Asia/Manila is UTC+8, no DST)
  const manilaFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = manilaFormatter.formatToParts(referenceNow);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") partMap[part.type] = part.value;
  }

  const manilaDateStr = `${partMap.year}-${partMap.month}-${partMap.day}`;
  const manilaHour = parseInt(partMap.hour, 10);
  const manilaMinute = parseInt(partMap.minute, 10);

  // 4. Time comparisons
  if (appointmentDate < manilaDateStr) {
    return { valid: false, error: "Appointment date cannot be in the past." };
  }

  if (appointmentDate === manilaDateStr) {
    const apptTotalMinutes = hour24 * 60 + minute;
    const nowTotalMinutes = manilaHour * 60 + manilaMinute;

    if (apptTotalMinutes < nowTotalMinutes) {
      return { valid: false, error: "Appointment time has already passed today (Asia/Manila)." };
    }
    if (apptTotalMinutes === nowTotalMinutes) {
      return { valid: false, error: "Appointment time cannot be at the current minute; please choose a future slot." };
    }
  }

  return {
    valid: true,
    normalizedDate: appointmentDate,
    normalizedTime: `${hour24.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`,
  };
}
