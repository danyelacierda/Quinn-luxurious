import "server-only";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export type DeductResult = {
  error: string | null;
  message?: string;
  deducted?: boolean;
};

/**
 * Deduct inventory when an appointment is completed.
 *
 * WHAT THIS DOES:
 * Deducts the required inventory items specified by a service's recipe when an appointment is marked completed.
 *
 * WHY THIS EXISTS (Security & Business Architecture):
 * 1. Internal Server-Only Module (No "use server"): This file intentionally does NOT contain the
 *    "use server" directive. A "use server" file instructs Next.js to expose every exported function
 *    as a public RPC endpoint accessible via HTTP POST from any client on the internet. Omitting
 *    "use server" ensures this function remains strictly an internal server helper that can NEVER
 *    be invoked directly from a browser or client.
 * 2. "server-only" Guard: The `import "server-only"` directive guarantees at build-time that this
 *    module cannot be bundled into client-side code, protecting backend logic and service credentials.
 * 3. Supabase Admin Reuse: Reuses `createAdminClient()` from `@/lib/supabase/admin`, avoiding duplicate
 *    client instantiations while enforcing service-role operations within server boundaries.
 * 4. Idempotency Guard: Checks `appointment_inventory_deductions` before executing. If inventory has
 *    already been deducted for this appointment ID, it immediately exits without double-deducting.
 * 5. Pre-check (Negative Stock Prevention): Checks all recipe ingredients against current stock BEFORE
 *    making any database updates. If any item has insufficient stock, it aborts early with an error,
 *    preventing stock from dropping into negative values.
 * 6. Audit & Attribution: Records individual `inventory_movements` linked to the appointment, service,
 *    assigned staff member, and caller user ID.
 *
 * WHO MAY CALL THIS & HOW ENFORCED:
 * Callers MUST authorize the user before invoking this function. It is currently called by:
 * - `updateAppointmentStatus` in `lib/actions/admin.ts`: Enforces admin authorization via `requireAdmin()`,
 *   which verifies the caller's admin role (via verified primary email in `ADMIN_EMAILS`, Clerk `publicMetadata.role === "admin"`, or Clerk session claims role).
 * - `markAppointmentCompletedByStaff` in `lib/actions/admin.ts`: Enforces that the caller is an active staff
 *   member assigned to this appointment (or an admin) via Clerk `auth()`, active staff profile check (`is_active = true`), and assignment verification.
 */
export async function deductInventoryForCompletedAppointment(
  appointmentId: string,
  callerUserId?: string
): Promise<DeductResult> {
  // Reuses centralized admin client. Cast to any because the typed client infers joined recipe queries
  // (.select("..., inventory_items(...)")) as never due to empty Relationships in generated Database types.
  const supabaseAdmin: any = createAdminClient();

  if (!appointmentId) return { error: "Appointment ID is required." };

  // 1. Check idempotency: Has this appointment already deducted inventory?
  const { data: existingDeduction } = await supabaseAdmin
    .from("appointment_inventory_deductions")
    .select("id")
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  if (existingDeduction) {
    return { error: null, message: "Inventory already deducted for this appointment.", deducted: false };
  }

  // 2. Fetch appointment details
  const { data: appt, error: apptErr } = await supabaseAdmin
    .from("appointments")
    .select("id, service_id, staff_id, status")
    .eq("id", appointmentId)
    .single();

  if (apptErr || !appt) {
    return { error: "Appointment not found." };
  }

  // 3. Fetch recipe items for this service
  const { data: recipes, error: recipeErr } = await supabaseAdmin
    .from("service_inventory_recipes")
    .select("inventory_item_id, quantity, inventory_items(id, name, current_stock, unit, is_active)")
    .eq("service_id", appt.service_id);

  if (recipeErr || !recipes || recipes.length === 0) {
    // No products configured for this service: record deduction marker and exit cleanly
    await supabaseAdmin.from("appointment_inventory_deductions").insert({
      appointment_id: appointmentId,
      service_id: appt.service_id,
      staff_id: appt.staff_id,
    });
    return { error: null, message: "No inventory items consumed for this service.", deducted: true };
  }

  // 4. Pre-check: Ensure all items have sufficient stock
  for (const r of recipes) {
    const item = (r as any).inventory_items;
    if (!item) continue;

    const available = Number(item.current_stock ?? 0);
    const required = Number(r.quantity);

    if (available < required) {
      return {
        error: "Insufficient stock for " + item.name + ". Required: " + required + " " + item.unit + ", Available: " + available + " " + item.unit + ". Please restock before completing this appointment.",
      };
    }
  }

  // 5. Deduct each item and record movement
  for (const r of recipes) {
    const item = (r as any).inventory_items;
    if (!item) continue;

    const currentStock = Number(item.current_stock ?? 0);
    const quantity = Number(r.quantity);
    const newStock = Number((currentStock - quantity).toFixed(2));

    await supabaseAdmin
      .from("inventory_items")
      .update({ current_stock: newStock, updated_at: new Date().toISOString() })
      .eq("id", item.id);

    await supabaseAdmin.from("inventory_movements").insert({
      inventory_item_id: item.id,
      change_quantity: -quantity,
      previous_stock: currentStock,
      new_stock: newStock,
      movement_type: "service_consumption",
      reason: "Appointment completion usage",
      appointment_id: appointmentId,
      service_id: appt.service_id,
      staff_id: appt.staff_id,
      created_by_user_id: callerUserId || null,
    });
  }

  // 6. Record deduction marker
  await supabaseAdmin.from("appointment_inventory_deductions").insert({
    appointment_id: appointmentId,
    service_id: appt.service_id,
    staff_id: appt.staff_id,
  });

  revalidatePath("/admin");
  revalidatePath("/staff");
  return { error: null, message: "Inventory successfully deducted for completed appointment.", deducted: true };
}
