"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import type { AppointmentStatus, ServiceCategory } from "@/lib/supabase/types";

import { auth } from "@clerk/nextjs/server";

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return { supabase: supabaseAdmin, ok: false as const, error: "Not signed in." };

  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("id", userId)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return { supabase: supabaseAdmin, ok: false as const, error: "You don't have access to do that." };
  }
  return { supabase: supabaseAdmin, ok: true as const, error: null };
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

export async function markPaidInCash(appointmentId: string): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };
  
  const { data: appt } = await gate.supabase.from("appointments").select("expected_balance").eq("id", appointmentId).single();
  
  const { error } = await gate.supabase
    .from("appointments")
    .update({ payment_status: "fully_paid", balance_paid: appt?.expected_balance || 0, payment_method: "cash" })
    .eq("id", appointmentId);
    
  revalidatePath("/admin");
  return { error: error ? "Failed to mark as paid in cash." : null };
}

export async function generateBalancePaymentLink(appointmentId: string): Promise<{ ok: boolean, url?: string, error?: string }> {
  const gate = await requireAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };
  
  const { data: appt, error: fetchErr } = await gate.supabase
    .from("appointments")
    .select("*, services(name)")
    .eq("id", appointmentId)
    .single();
    
  if (fetchErr || !appt || !appt.expected_balance) return { ok: false, error: "Invalid appointment for balance payment." };
  if (appt.payment_status === "fully_paid") return { ok: false, error: "Already fully paid." };
  
  try {
     const payload = {
      data: {
        attributes: {
          send_email_receipt: true,
          show_description: true,
          show_line_items: [{
            currency: "PHP",
            amount: Math.round(appt.expected_balance * 100),
            description: "Remaining balance payment",
            name: `${appt.services?.name || "Service"} Balance`,
            quantity: 1
          }],
          payment_method_types: ["gcash", "paymaya", "card", "grab_pay"],
          description: `Balance payment for ${appt.full_name}`,
          success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/account?success=true`,
          cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/`,
          metadata: { appointment_id: appt.id, type: "balance" }
        }
      }
    };

    const res = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Basic ${btoa(process.env.PAYMONGO_SECRET_KEY! + ":")}` },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) throw new Error("PayMongo API failed");
    
    const checkout = await res.json();
    const checkoutUrl = checkout.data.attributes.checkout_url;
    
    await gate.supabase.from("appointments").update({ paymongo_balance_checkout_id: checkout.data.id }).eq("id", appointmentId);
    
    revalidatePath("/admin");
    return { ok: true, url: checkoutUrl };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to generate link" };
  }
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
