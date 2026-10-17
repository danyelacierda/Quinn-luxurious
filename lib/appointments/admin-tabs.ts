/**
 * Pure utilities for the Admin Appointments Tabbed View:
 * - Filtering into Upcoming, Completed, and Cancelled tabs
 * - Accurate time-to-minutes parsing (supporting both 12-hour and 24-hour formats)
 * - Deterministic sorting by date and time (never sorting by created_at)
 * - Grouping appointments under clean, chronological date headers
 */

export type AppointmentTab = "upcoming" | "completed" | "cancelled";

/**
 * Parses any valid time string in either 24-hour format ("11:00", "09:30", "14:15")
 * or 12-hour format ("3:30 PM", "11:00 AM", "12:00 PM", "12:15 AM")
 * into total minutes since midnight (0 - 1439).
 * Returns 0 if input is falsy or unparseable.
 */
export function parseTimeToMinutes(timeStr: string | null | undefined): number {
  if (!timeStr || typeof timeStr !== "string") return 0;
  const trimmed = timeStr.trim().toUpperCase();

  // 12-hour format: e.g. "3:30 PM", "11:00 AM", "12:30 PM"
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const modifier = match12[3];

    if (modifier === "PM" && hours < 12) {
      hours += 12;
    } else if (modifier === "AM" && hours === 12) {
      hours = 0;
    }
    return hours * 60 + minutes;
  }

  // 24-hour format: e.g. "11:00", "09:30", "15:45"
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    return hours * 60 + minutes;
  }

  return 0;
}

/**
 * Tab status mapping rules:
 * - "upcoming": active bookings (pending, pending_payment, confirmed)
 * - "completed": completed bookings (completed)
 * - "cancelled": cancelled bookings (cancelled)
 */
export function filterAppointmentsByTab<T extends { status: string }>(
  appointments: T[],
  tab: AppointmentTab
): T[] {
  if (tab === "upcoming") {
    return appointments.filter(
      (a) =>
        a.status === "pending" ||
        a.status === "pending_payment" ||
        a.status === "confirmed"
    );
  }
  if (tab === "completed") {
    return appointments.filter((a) => a.status === "completed");
  }
  if (tab === "cancelled") {
    return appointments.filter((a) => a.status === "cancelled");
  }
  return appointments;
}

/**
 * Calculates counts for each tab from the full appointment list.
 */
export function getAppointmentTabCounts<T extends { status: string }>(
  appointments: T[]
): Record<AppointmentTab, number> {
  let upcoming = 0;
  let completed = 0;
  let cancelled = 0;

  for (const a of appointments) {
    if (
      a.status === "pending" ||
      a.status === "pending_payment" ||
      a.status === "confirmed"
    ) {
      upcoming++;
    } else if (a.status === "completed") {
      completed++;
    } else if (a.status === "cancelled") {
      cancelled++;
    }
  }

  return { upcoming, completed, cancelled };
}

/**
 * Sorts appointments according to business rules:
 * - Upcoming: appointment_date ascending (soonest first), then time ascending (earliest first)
 * - Completed & Cancelled: appointment_date descending (most recent first), then time descending (latest first)
 * - NEVER sorts by created_at.
 */
export function sortAppointmentsForTab<
  T extends { appointment_date: string; appointment_time: string }
>(appointments: T[], tab: AppointmentTab): T[] {
  const isUpcoming = tab === "upcoming";

  return [...appointments].sort((a, b) => {
    // 1. Compare dates (ISO format YYYY-MM-DD compares lexicographically)
    const dateComparison = a.appointment_date.localeCompare(b.appointment_date);
    if (dateComparison !== 0) {
      return isUpcoming ? dateComparison : -dateComparison;
    }

    // 2. Compare parsed minutes since midnight
    const timeA = parseTimeToMinutes(a.appointment_time);
    const timeB = parseTimeToMinutes(b.appointment_time);
    return isUpcoming ? timeA - timeB : timeB - timeA;
  });
}

/**
 * Formats a date string ("YYYY-MM-DD") into a clean date header (e.g. "Sunday, October 18, 2026").
 * Uses UTC representation to avoid client-side timezone day shifts.
 */
export function formatDateHeader(dateStr: string): string {
  if (!dateStr || typeof dateStr !== "string") return "Undated Appointments";
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return dateStr;

  const [year, month, day] = parts;
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export interface DateGroup<T> {
  date: string;
  formattedDate: string;
  appointments: T[];
}

/**
 * Groups already-sorted appointments under consecutive date headers,
 * preserving the sorted order of dates and individual appointments.
 */
export function groupAppointmentsByDate<T extends { appointment_date: string }>(
  sortedAppointments: T[]
): DateGroup<T>[] {
  const groups: DateGroup<T>[] = [];
  let currentGroup: DateGroup<T> | null = null;

  for (const appt of sortedAppointments) {
    if (!currentGroup || currentGroup.date !== appt.appointment_date) {
      currentGroup = {
        date: appt.appointment_date,
        formattedDate: formatDateHeader(appt.appointment_date),
        appointments: [appt],
      };
      groups.push(currentGroup);
    } else {
      currentGroup.appointments.push(appt);
    }
  }

  return groups;
}

/**
 * Convenience pipeline helper: filters, sorts, and groups appointments for a selected tab.
 */
export function getTabAppointmentsGroupedByDate<
  T extends { status: string; appointment_date: string; appointment_time: string }
>(appointments: T[], tab: AppointmentTab): DateGroup<T>[] {
  const filtered = filterAppointmentsByTab(appointments, tab);
  const sorted = sortAppointmentsForTab(filtered, tab);
  return groupAppointmentsByDate(sorted);
}
