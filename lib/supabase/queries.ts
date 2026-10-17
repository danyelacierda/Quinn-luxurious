import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  const { userId } = await auth();
  if (!userId) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("getCurrentUser:", error.message);
    return null;
  }

  // Local development auto-sync workaround if webhooks are not yet connected
  if (!data) {
    const { currentUser } = await import("@clerk/nextjs/server");
    const clerkUser = await currentUser();
    if (clerkUser) {
      const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
      const { data: newData, error: insertError } = await supabase
        .from("users")
        .insert({
          id: userId,
          full_name: `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || email.split("@")[0],
          email: email,
          role: "customer",
        })
        .select()
        .single();

      if (!insertError && newData) {
        return newData;
      }
    }
  }

  return data;
}

export type AppointmentWithDetails = AppointmentRow & {
  services: { name: string; duration_minutes: number; price: number } | null;
  staff: { full_name: string } | null;
  deposit_amount?: number;
  balance_paid?: number;
  expected_deposit?: number;
  expected_balance?: number;
  needs_refund?: boolean;
};

/**
 * Customer appointment retrieval:
 * Strict server check: Only returns appointments belonging to the logged-in user.
 */
export async function getUserAppointments(): Promise<AppointmentWithDetails[]> {
  const { userId } = await auth();
  if (!userId) return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("*, services(name, duration_minutes, price), staff(full_name)")
    .eq("customer_id", userId)
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true });

  if (error) {
    console.error("getUserAppointments:", error.message);
    return [];
  }
  return (data ?? []) as unknown as AppointmentWithDetails[];
}

/**
 * Admin appointment retrieval:
 * Strict server check: Requires admin authorization.
 */
export async function getAllAppointments(): Promise<AppointmentWithDetails[]> {
  const { requireAdmin } = await import("@/lib/auth");
  const isAdmin = await requireAdmin();
  if (!isAdmin) {
    console.warn("Unauthorized attempt to access getAllAppointments");
    return [];
  }

  const supabase = createAdminClient();
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

export type StaffWithStats = StaffRow & {
  assigned_count: number;
  upcoming_count: number;
  user_email?: string | null;
};

export async function getAllStaff(): Promise<StaffWithStats[]> {
  const supabase = createAdminClient();
  const { data: staff, error } = await supabase.from("staff").select("*").order("full_name");
  if (error || !staff) {
    console.error("getAllStaff:", error?.message);
    return [];
  }

  const todayManila = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const { data: appts } = await supabase
    .from("appointments")
    .select("staff_id, appointment_date, status");

  const { data: users } = await supabase
    .from("users")
    .select("id, email");

  const emailMap = new Map<string, string>();
  (users ?? []).forEach((u) => emailMap.set(u.id, u.email));

  const totalCounts = new Map<string, number>();
  const upcomingCounts = new Map<string, number>();

  (appts ?? []).forEach((a) => {
    if (a.staff_id) {
      totalCounts.set(a.staff_id, (totalCounts.get(a.staff_id) ?? 0) + 1);
      if (
        a.appointment_date >= todayManila &&
        ["confirmed", "pending", "pending_payment"].includes(a.status)
      ) {
        upcomingCounts.set(a.staff_id, (upcomingCounts.get(a.staff_id) ?? 0) + 1);
      }
    }
  });

  return staff.map((s) => ({
    ...s,
    assigned_count: totalCounts.get(s.id) ?? 0,
    upcoming_count: upcomingCounts.get(s.id) ?? 0,
    user_email: s.user_id ? emailMap.get(s.user_id) ?? null : null,
  }));
}

export type StaffPortalData = {
  staff: StaffRow | null;
  appointments: AppointmentWithDetails[];
};

/**
 * Staff portal retrieval:
 * Strict server check: Only returns appointments assigned to the logged-in staff member's profile.
 */
export async function getStaffAppointments(): Promise<StaffPortalData> {
  const { userId } = await auth();
  if (!userId) return { staff: null, appointments: [] };

  const supabase = createAdminClient();

  // Find staff record linked to this Clerk user
  const { data: staff, error: staffErr } = await supabase
    .from("staff")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (staffErr || !staff) {
    return { staff: null, appointments: [] };
  }

  const { data: appts, error: apptErr } = await supabase
    .from("appointments")
    .select("*, services(name, duration_minutes, price), staff(full_name)")
    .eq("staff_id", staff.id)
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true });

  if (apptErr) {
    console.error("getStaffAppointments:", apptErr.message);
    return { staff, appointments: [] };
  }

  return {
    staff,
    appointments: (appts ?? []) as unknown as AppointmentWithDetails[],
  };
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

/**
 * Admin customer retrieval:
 * Strict server check: Requires admin authorization.
 */
export async function getCustomers(): Promise<CustomerWithStats[]> {
  const { requireAdmin } = await import("@/lib/auth");
  const isAdmin = await requireAdmin();
  if (!isAdmin) {
    console.warn("Unauthorized attempt to access getCustomers");
    return [];
  }

  const supabase = createAdminClient();
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
 */
export { BUSINESS_HOURS, generateSlotsForDate } from "@/lib/businessHours";
import { BUSINESS_HOURS, generateSlotsForDate } from "@/lib/businessHours";

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

import type { 
  InventoryItemRow, 
  ServiceRecipeRow, 
  InventoryMovementRow, 
  AppointmentDeductionRow 
} from "@/lib/supabase/types";

export type InventoryItemWithDetails = InventoryItemRow & {
  is_low_stock: boolean;
};

export type ServiceRecipeWithDetails = ServiceRecipeRow & {
  services?: { name: string; category: string } | null;
  inventory_items?: { name: string; unit: string; current_stock: number } | null;
};

export type InventoryMovementWithDetails = InventoryMovementRow & {
  inventory_items?: { name: string; unit: string } | null;
  services?: { name: string } | null;
  staff?: { full_name: string } | null;
  appointments?: { full_name: string; appointment_date: string; appointment_time: string } | null;
};

/**
 * Fetch all inventory items for admin dashboard
 */
export async function getAllInventoryItems(): Promise<InventoryItemWithDetails[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .order("category")
    .order("name");

  if (error) {
    // If table doesn't exist yet in remote Supabase (review-only migration)
    return [];
  }

  return (data ?? []).map((item) => ({
    ...item,
    is_low_stock: item.current_stock <= item.low_stock_threshold,
  }));
}

/**
 * Fetch service recipes (products used per service)
 */
export async function getServiceRecipes(): Promise<ServiceRecipeWithDetails[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("service_inventory_recipes")
    .select("*, services(name, category), inventory_items(name, unit, current_stock)")
    .order("created_at", { ascending: false });

  if (error) {
    return [];
  }
  return (data ?? []) as unknown as ServiceRecipeWithDetails[];
}

/**
 * Fetch recent inventory movements (stock movement audit log)
 */
export async function getInventoryMovements(limit = 100): Promise<InventoryMovementWithDetails[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("inventory_movements")
    .select("*, inventory_items(name, unit), services(name), staff(full_name), appointments(full_name, appointment_date, appointment_time)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return [];
  }
  return (data ?? []) as unknown as InventoryMovementWithDetails[];
}
