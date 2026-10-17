"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import type { AppointmentStatus, ServiceCategory } from "@/lib/supabase/types";
import { requireAdmin as checkIsAdmin, getCurrentUserRole } from "@/lib/auth";
import { isValidEmail } from "@/lib/validation";

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function requireAdmin() {
  const isAdmin = await checkIsAdmin();

  if (!isAdmin) {
    return { supabase: supabaseAdmin, ok: false as const, error: "Forbidden" };
  }
  return { supabase: supabaseAdmin, ok: true as const, error: null };
}

export type ActionResult = { error: string | null; message?: string | null };

// ---------- Appointments ----------
export async function updateAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus
): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const { userId } = await auth();

  // If completing appointment, deduct inventory first to prevent negative stock
  if (status === "completed") {
    const { deductInventoryForCompletedAppointment } = await import("@/lib/actions/inventory");
    const deductionRes = await deductInventoryForCompletedAppointment(appointmentId, userId || undefined);
    if (deductionRes.error) {
      return { error: deductionRes.error };
    }
  }

  const { error } = await gate.supabase
    .from("appointments")
    .update({ status })
    .eq("id", appointmentId);

  revalidatePath("/admin");
  revalidatePath("/staff");
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
  revalidatePath("/staff");
  return { error: error ? "Failed to mark as paid in cash." : null };
}

export async function confirmPayment(appointmentId: string): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };
  
  const { data: appt } = await gate.supabase
    .from("appointments")
    .select("expected_balance, payment_method, payment_status")
    .eq("id", appointmentId)
    .single();
    
  if (appt?.payment_method !== "qr_ph" || appt?.payment_status !== "pending") {
    // Silent success if already processed or not applicable
    return { error: null };
  }
  
  const { error } = await gate.supabase
    .from("appointments")
    .update({ payment_status: "fully_paid", balance_paid: appt.expected_balance || 0 })
    .eq("id", appointmentId);
    
  revalidatePath("/admin");
  revalidatePath("/staff");
  return { error: error ? "Failed to confirm payment." : null };
}

/**
 * Assign or reassign an appointment to an eligible staff member.
 * Strictly verifies admin role, staff active status, and scheduling conflicts.
 */
export async function assignStaffToAppointment(
  appointmentId: string,
  staffId: string | null
): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  if (!appointmentId) {
    return { error: "Appointment ID is required." };
  }

  // Fetch the target appointment
  const { data: targetAppt, error: apptErr } = await gate.supabase
    .from("appointments")
    .select("id, appointment_date, appointment_time, status")
    .eq("id", appointmentId)
    .single();

  if (apptErr || !targetAppt) {
    return { error: "Appointment not found." };
  }

  // If assigning to a specific staff member (not unassigning)
  if (staffId && staffId.trim() !== "") {
    // 1. Validate staff member exists and is active
    const { data: staffMember, error: staffErr } = await gate.supabase
      .from("staff")
      .select("id, full_name, is_active")
      .eq("id", staffId)
      .single();

    if (staffErr || !staffMember) {
      return { error: "Selected staff member does not exist." };
    }

    if (!staffMember.is_active) {
      return { error: "Cannot assign: Staff member " + staffMember.full_name + " is currently inactive." };
    }

    // 2. Check for scheduling conflicts at the same date and time
    // Conflict exists if the staff member already has an active (confirmed, pending, pending_payment) appointment
    const { data: conflicts, error: conflictErr } = await gate.supabase
      .from("appointments")
      .select("id, full_name, appointment_time")
      .eq("staff_id", staffId)
      .eq("appointment_date", targetAppt.appointment_date)
      .eq("appointment_time", targetAppt.appointment_time)
      .neq("id", appointmentId)
      .in("status", ["confirmed", "pending", "pending_payment"]);

    if (conflictErr) {
      return { error: "Failed to verify staff availability." };
    }

    if (conflicts && conflicts.length > 0) {
      return {
        error: "Scheduling conflict: " + staffMember.full_name + " is already booked for an appointment at " + targetAppt.appointment_time + " on " + targetAppt.appointment_date + ".",
      };
    }
  }

  // Safe update: assign or unassign
  const finalStaffId = staffId && staffId.trim() !== "" ? staffId : null;
  const { error: updateErr } = await gate.supabase
    .from("appointments")
    .update({ staff_id: finalStaffId })
    .eq("id", appointmentId);

  if (updateErr) {
    return { error: "Failed to update staff assignment." };
  }

  revalidatePath("/admin");
  revalidatePath("/staff");
  return { error: null, message: "Staff assignment updated successfully." };
}

/**
 * Staff-authorized action: Mark appointment as completed.
 * Strictly verifies that the authenticated user owns this staff profile
 * and that the appointment is assigned to THEM.
 */
export async function markAppointmentCompletedByStaff(
  appointmentId: string
): Promise<ActionResult> {
  const { userId } = await auth();
  if (!userId) {
    return { error: "Unauthorized: Sign in required." };
  }

  const role = await getCurrentUserRole();
  const isAdmin = role === "admin";

  // Resolve staff profile
  const { data: staffRecord } = await supabaseAdmin
    .from("staff")
    .select("id, full_name, is_active")
    .eq("user_id", userId)
    .maybeSingle();

  if (!isAdmin && (!staffRecord || !staffRecord.is_active)) {
    return { error: "Unauthorized: You do not have an active staff profile." };
  }

  // Fetch appointment to verify assignment
  const { data: appt, error: apptErr } = await supabaseAdmin
    .from("appointments")
    .select("id, staff_id, status")
    .eq("id", appointmentId)
    .single();

  if (apptErr || !appt) {
    return { error: "Appointment not found." };
  }

  // If not admin, staff can ONLY complete appointments assigned to themselves
  if (!isAdmin && appt.staff_id !== staffRecord?.id) {
    return { error: "Forbidden: You can only update appointments assigned to you." };
  }

  // Deduct inventory before completing
  const { deductInventoryForCompletedAppointment } = await import("@/lib/actions/inventory");
  const deductionRes = await deductInventoryForCompletedAppointment(appointmentId, userId || undefined);
  if (deductionRes.error) {
    return { error: deductionRes.error };
  }

  const { error: updateErr } = await supabaseAdmin
    .from("appointments")
    .update({ status: "completed" })
    .eq("id", appointmentId);

  if (updateErr) {
    return { error: "Failed to mark appointment as completed." };
  }

  revalidatePath("/staff");
  revalidatePath("/admin");
  return { error: null, message: "Appointment marked as completed." };
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
  revalidatePath("/staff");
  return { error: error ? "Couldn't save that staff member." : null };
}

export async function toggleStaffActive(id: string, isActive: boolean): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const { error } = await gate.supabase.from("staff").update({ is_active: isActive }).eq("id", id);
  revalidatePath("/admin");
  revalidatePath("/staff");
  return { error: error ? "Couldn't update that staff member." : null };
}

/**
 * Safely delete a staff member according to Instructor Rule #11:
 * 1. Checks if staff member has any upcoming active appointments.
 * 2. If upcoming active appointments exist, REJECTS deletion with a clear error.
 * 3. If no upcoming active appointments, sets staff_id = null on past/cancelled appointments
 *    to preserve customer appointment history, reverts user role if linked, and deletes staff record.
 */
export async function deleteStaffMember(staffId: string): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  if (!staffId) return { error: "Staff ID is required." };

  // Fetch staff record
  const { data: staffMember, error: staffErr } = await gate.supabase
    .from("staff")
    .select("id, full_name, user_id")
    .eq("id", staffId)
    .single();

  if (staffErr || !staffMember) {
    return { error: "Staff member not found." };
  }

  // Get current Manila date (YYYY-MM-DD)
  const todayManila = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  // Check for upcoming active appointments
  const { data: upcomingAppts, error: apptErr } = await gate.supabase
    .from("appointments")
    .select("id, appointment_date, appointment_time, status")
    .eq("staff_id", staffId)
    .gte("appointment_date", todayManila)
    .in("status", ["confirmed", "pending", "pending_payment"]);

  if (apptErr) {
    return { error: "Failed to check staff appointment history." };
  }

  if (upcomingAppts && upcomingAppts.length > 0) {
    return {
      error: "Cannot delete staff member with " + upcomingAppts.length + " upcoming appointment(s). Please reassign or cancel their upcoming appointments first.",
    };
  }

  // Preserve historical records: unlink staff from any past or cancelled appointments
  const { error: unlinkErr } = await gate.supabase
    .from("appointments")
    .update({ staff_id: null })
    .eq("staff_id", staffId);

  if (unlinkErr) {
    return { error: "Failed to safely unlink historical appointments." };
  }

  // If this staff member had a linked Clerk user in public.users, revert role to customer
  if (staffMember.user_id) {
    await gate.supabase
      .from("users")
      .update({ role: "customer" })
      .eq("id", staffMember.user_id);
  }

  // Delete staff record
  const { error: deleteErr } = await gate.supabase
    .from("staff")
    .delete()
    .eq("id", staffId);

  if (deleteErr) {
    return { error: "Failed to delete staff member." };
  }

  revalidatePath("/admin");
  revalidatePath("/staff");
  return { error: null, message: "Staff member " + staffMember.full_name + " was safely removed. Past appointment history was preserved." };
}

/**
 * Invite staff member securely via Clerk backend invitation.
 * Admin-only, validates email, creates/links staff profile with 'staff' role.
 */
export async function inviteStaffMember(formData: FormData): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const roleTitle = String(formData.get("roleTitle") ?? "").trim() || "Staff Member";
  const bio = String(formData.get("bio") ?? "").trim();
  const existingStaffId = String(formData.get("staffId") ?? "").trim() || undefined;

  if (!fullName) {
    return { error: "Please enter staff member full name." };
  }

  if (!email || !isValidEmail(email)) {
    return { error: "Please enter a valid email address." };
  }

  let staffId = existingStaffId;

  // If not linking existing staff profile, create new staff record
  if (!staffId) {
    const { data: newStaff, error: insertErr } = await gate.supabase
      .from("staff")
      .insert({
        full_name: fullName,
        role_title: roleTitle,
        bio: bio || null,
        is_active: true,
      })
      .select("id")
      .single();

    if (insertErr || !newStaff) {
      return { error: "Failed to create staff profile record." };
    }
    staffId = newStaff.id;
  }

  // Now trigger Clerk invitation workflow
  try {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const client = await clerkClient();

    // Check if an existing Clerk user has this email
    const existingUsers = await client.users.getUserList({ emailAddress: [email] });
    if (existingUsers.data && existingUsers.data.length > 0) {
      const existingUser = existingUsers.data[0];

      // Update publicMetadata to staff
      await client.users.updateUserMetadata(existingUser.id, {
        publicMetadata: { role: "staff", staff_id: staffId },
      });

      // Link staff record to Clerk user
      await gate.supabase
        .from("staff")
        .update({ user_id: existingUser.id, role_title: roleTitle })
        .eq("id", staffId);

      // Update users table role
      await gate.supabase
        .from("users")
        .upsert(
          {
            id: existingUser.id,
            email: email,
            full_name: fullName,
            role: "staff",
          },
          { onConflict: "id" }
        );

      revalidatePath("/admin");
      revalidatePath("/staff");
      return {
        error: null,
        message: "User " + email + " already has an account. Granted staff role and linked to staff profile.",
      };
    }

    // User is new: Send Clerk Invitation
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    await client.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: appUrl + "/staff",
      publicMetadata: {
        role: "staff",
        staff_id: staffId,
      },
      ignoreExisting: false,
    });

    revalidatePath("/admin");
    return {
      error: null,
      message: "Clerk invitation sent to " + email + ". When accepted, their account will be linked to " + fullName + ".",
    };
  } catch (err: any) {
    console.error("Clerk staff invitation error:", err);
    const clerkCode = err?.errors?.[0]?.code;
    if (clerkCode === "form_identifier_exists") {
      return {
        error: "An invitation has already been sent to " + email + ". Please ask them to check their inbox.",
      };
    }
    // If Clerk secret is missing in test or development
    return {
      error: null,
      message: "Staff profile for " + fullName + " created successfully. Note: Clerk invitation could not be sent (" + (err?.message || "Check Clerk API configuration") + "). You can link their account once registered.",
    };
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
