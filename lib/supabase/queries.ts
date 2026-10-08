import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

export type ServiceRow = Tables<"services">;
export type StaffRow = Tables<"staff">;
export type ReviewRow = Tables<"reviews">;
export type GalleryRow = Tables<"gallery">;
export type PromotionRow = Tables<"promotions">;
export type AppointmentRow = Tables<"appointments">;
export type UserRow = Tables<"users">;

export async function getActiveServices(): Promise<ServiceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("is_active", true)
    .order("category")
    .order("name");

  if (error) {
    console.error("getActiveServices:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getFeaturedServices(limit = 4): Promise<ServiceRow[]> {
  const services = await getActiveServices();
  return services.slice(0, limit);
}

export async function getServiceById(id: string): Promise<ServiceRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("services").select("*").eq("id", id).single();
  if (error) {
    console.error("getServiceById:", error.message);
    return null;
  }
  return data;
}

export async function getActiveStaff(): Promise<StaffRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff")
    .select("*")
    .eq("is_active", true)
    .order("full_name");

  if (error) {
    console.error("getActiveStaff:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getReviews(limit = 20): Promise<ReviewRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("getReviews:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getGalleryItems(): Promise<GalleryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gallery")
    .select("*")
    .order("sort_order")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getGalleryItems:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getActivePromotions(): Promise<PromotionRow[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("promotions")
    .select("*")
    .eq("is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${today}`)
    .or(`ends_at.is.null,ends_at.gte.${today}`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getActivePromotions:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Returns the current session's `public.users` row, or null if signed out.
 */
export async function getCurrentUser(): Promise<UserRow | null> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return null;

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", authData.user.id)
    .single();

  if (error) {
    console.error("getCurrentUser:", error.message);
    return null;
  }
  return data;
}

export type AppointmentWithDetails = AppointmentRow & {
  services: { name: string; duration_minutes: number; price: number } | null;
  staff: { full_name: string } | null;
};

export async function getUserAppointments(): Promise<AppointmentWithDetails[]> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return [];

  const { data, error } = await supabase
    .from("appointments")
    .select("*, services(name, duration_minutes, price), staff(full_name)")
    .eq("customer_id", authData.user.id)
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true });

  if (error) {
    console.error("getUserAppointments:", error.message);
    return [];
  }
  return (data ?? []) as unknown as AppointmentWithDetails[];
}

export async function getAllAppointments(): Promise<AppointmentWithDetails[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("*, services(name, duration_minutes, price), staff(full_name)")
    .order("appointment_date", { ascending: false })
    .order("appointment_time", { ascending: true });

  if (error) {
    console.error("getAllAppointments:", error.message);
    return [];
  }
  return (data ?? []) as unknown as AppointmentWithDetails[];
}

export async function getAllServices(): Promise<ServiceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("services").select("*").order("category").order("name");
  if (error) {
    console.error("getAllServices:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getAllStaff(): Promise<StaffRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("staff").select("*").order("full_name");
  if (error) {
    console.error("getAllStaff:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getAllPromotions(): Promise<PromotionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("promotions").select("*").order("created_at", { ascending: false });
  if (error) {
    console.error("getAllPromotions:", error.message);
    return [];
  }
  return data ?? [];
}

export type CustomerWithStats = UserRow & { appointment_count: number };

export async function getCustomers(): Promise<CustomerWithStats[]> {
  const supabase = await createClient();
  const { data: users, error } = await supabase
    .from("users")
    .select("*")
    .eq("role", "customer")
    .order("created_at", { ascending: false });

  if (error || !users) {
    console.error("getCustomers:", error?.message);
    return [];
  }

  const { data: appts } = await supabase.from("appointments").select("customer_id");
  const counts = new Map<string, number>();
  (appts ?? []).forEach((a) => {
    if (a.customer_id) counts.set(a.customer_id, (counts.get(a.customer_id) ?? 0) + 1);
  });

  return users.map((u) => ({ ...u, appointment_count: counts.get(u.id) ?? 0 }));
}

/**
 * Business hours used to generate bookable time slots.
 * Kept here (not in the DB) since it rarely changes — edit freely.
 */
export const BUSINESS_HOURS: Record<number, { open: string; close: string } | null> = {
  0: { open: "11:00", close: "16:00" }, // Sunday
  1: { open: "09:00", close: "19:00" },
  2: { open: "09:00", close: "19:00" },
  3: { open: "09:00", close: "19:00" },
  4: { open: "09:00", close: "19:00" },
  5: { open: "09:00", close: "19:00" },
  6: { open: "09:00", close: "18:00" }, // Saturday
};

function to12Hour(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

/**
 * Generates every bookable slot start-time label for a given date,
 * spaced by `stepMinutes`, that leaves enough room for `durationMinutes`
 * before closing.
 */
export function generateSlotsForDate(date: Date, durationMinutes: number, stepMinutes = 30): string[] {
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
 * Returns the slot labels for `date` that are NOT already booked for the
 * given staff member (or, if `staffId` is null, not booked by ANY staff —
 * used for the "any available artist" option).
 */
export async function getAvailableSlots(
  dateISO: string,
  staffId: string | null,
  durationMinutes: number
): Promise<string[]> {
  const supabase = await createClient();
  const date = new Date(`${dateISO}T00:00:00`);
  const allSlots = generateSlotsForDate(date, durationMinutes);
  if (allSlots.length === 0) return [];

  let query = supabase
    .from("appointments")
    .select("appointment_time, staff_id")
    .eq("appointment_date", dateISO)
    .neq("status", "cancelled");

  if (staffId) {
    query = query.eq("staff_id", staffId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("getAvailableSlots:", error.message);
    return allSlots;
  }

  const taken = new Set((data ?? []).map((row) => row.appointment_time));
  return allSlots.filter((slot) => !taken.has(slot));
}
