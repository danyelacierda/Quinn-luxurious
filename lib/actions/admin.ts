"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { AppointmentStatus, ServiceCategory } from "@/lib/supabase/types";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { supabase, ok: false as const, error: "Not signed in." };

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", authData.user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return { supabase, ok: false as const, error: "You don't have access to do that." };
  }
  return { supabase, ok: true as const, error: null };
}

type ActionResult = { error: string | null };

// ---------- Appointments ----------
export async function updateAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus
): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const { error } = await gate.supabase
    .from("appointments")
    .update({ status })
    .eq("id", appointmentId);

  revalidatePath("/admin");
  return { error: error ? "Couldn't update that appointment." : null };
}

// ---------- Services ----------
export async function upsertService(formData: FormData): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const id = String(formData.get("id") ?? "") || undefined;
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "") as ServiceCategory;
  const description = String(formData.get("description") ?? "").trim();
  const duration = Number(formData.get("duration") ?? 0);
  const price = Number(formData.get("price") ?? 0);

  if (!name || !category || !duration || !price) {
    return { error: "Please fill in name, category, duration, and price." };
  }

  const payload = { name, category, description: description || null, duration_minutes: duration, price };
  const { error } = id
    ? await gate.supabase.from("services").update(payload).eq("id", id)
    : await gate.supabase.from("services").insert(payload);

  revalidatePath("/admin");
  revalidatePath("/services");
  revalidatePath("/");
  return { error: error ? "Couldn't save that service." : null };
}

export async function toggleServiceActive(id: string, isActive: boolean): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const { error } = await gate.supabase.from("services").update({ is_active: isActive }).eq("id", id);
  revalidatePath("/admin");
  revalidatePath("/services");
  revalidatePath("/");
  return { error: error ? "Couldn't update that service." : null };
}

// ---------- Staff ----------
export async function upsertStaff(formData: FormData): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const id = String(formData.get("id") ?? "") || undefined;
  const fullName = String(formData.get("fullName") ?? "").trim();
  const roleTitle = String(formData.get("roleTitle") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();

  if (!fullName) return { error: "Please enter a name." };

  const payload = { full_name: fullName, role_title: roleTitle || null, bio: bio || null };
  const { error } = id
    ? await gate.supabase.from("staff").update(payload).eq("id", id)
    : await gate.supabase.from("staff").insert(payload);

  revalidatePath("/admin");
  return { error: error ? "Couldn't save that staff member." : null };
}

export async function toggleStaffActive(id: string, isActive: boolean): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const { error } = await gate.supabase.from("staff").update({ is_active: isActive }).eq("id", id);
  revalidatePath("/admin");
  return { error: error ? "Couldn't update that staff member." : null };
}

// ---------- Gallery ----------
export async function addGalleryItem(formData: FormData): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const category = String(formData.get("category") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const caption = String(formData.get("caption") ?? "").trim();

  if (!category || !imageUrl) return { error: "Please fill in category and image URL." };

  const { error } = await gate.supabase
    .from("gallery")
    .insert({ category, image_url: imageUrl, caption: caption || null });

  revalidatePath("/admin");
  revalidatePath("/gallery");
  return { error: error ? "Couldn't add that gallery item." : null };
}

export async function deleteGalleryItem(id: string): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const { error } = await gate.supabase.from("gallery").delete().eq("id", id);
  revalidatePath("/admin");
  revalidatePath("/gallery");
  return { error: error ? "Couldn't remove that gallery item." : null };
}

// ---------- Promotions ----------
export async function upsertPromotion(formData: FormData): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const id = String(formData.get("id") ?? "") || undefined;
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const discountCode = String(formData.get("discountCode") ?? "").trim();
  const discountPercent = Number(formData.get("discountPercent") ?? 0) || null;

  if (!title) return { error: "Please enter a title." };

  const payload = {
    title,
    description: description || null,
    discount_code: discountCode || null,
    discount_percent: discountPercent,
  };
  const { error } = id
    ? await gate.supabase.from("promotions").update(payload).eq("id", id)
    : await gate.supabase.from("promotions").insert(payload);

  revalidatePath("/admin");
  revalidatePath("/");
  return { error: error ? "Couldn't save that promotion." : null };
}

export async function togglePromotionActive(id: string, isActive: boolean): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const { error } = await gate.supabase.from("promotions").update({ is_active: isActive }).eq("id", id);
  revalidatePath("/admin");
  revalidatePath("/");
  return { error: error ? "Couldn't update that promotion." : null };
}
