"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { requireAdmin as checkIsAdmin } from "@/lib/auth";
import { validateInventoryItemInput, validateStockAdjustment } from "@/lib/inventory";

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function requireAdmin() {
  const isAdmin = await checkIsAdmin();
  if (!isAdmin) {
    return { supabase: supabaseAdmin, ok: false as const, error: "Forbidden: Admin access required." };
  }
  return { supabase: supabaseAdmin, ok: true as const, error: null };
}

export type InventoryActionResult = {
  error: string | null;
  message?: string | null;
  deducted?: boolean;
};

/**
 * Create or edit an inventory item
 */
export async function upsertInventoryItem(formData: FormData): Promise<InventoryActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const { userId } = await auth();
  const id = String(formData.get("id") ?? "").trim() || undefined;
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim() || null;
  const category = String(formData.get("category") ?? "").trim() || "Consumables";
  const unit = String(formData.get("unit") ?? "").trim() || "pcs";
  const currentStock = Number(formData.get("currentStock") ?? 0);
  const lowStockThreshold = Number(formData.get("lowStockThreshold") ?? 5);
  const costPerUnit = Number(formData.get("costPerUnit") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const validation = validateInventoryItemInput({ name, unit, currentStock, lowStockThreshold });
  if (!validation.valid) {
    return { error: validation.error };
  }

  const payload = {
    name,
    sku,
    category,
    unit,
    current_stock: currentStock,
    low_stock_threshold: lowStockThreshold,
    cost_per_unit: costPerUnit >= 0 ? costPerUnit : 0,
    notes,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { error } = await gate.supabase
      .from("inventory_items")
      .update(payload)
      .eq("id", id);

    if (error) {
      return { error: "Failed to update inventory item: " + error.message };
    }
  } else {
    const { data: inserted, error } = await gate.supabase
      .from("inventory_items")
      .insert(payload)
      .select("id, current_stock")
      .single();

    if (error) {
      return { error: "Failed to create inventory item: " + error.message };
    }

    // If initial stock was entered, log initial restock movement
    if (inserted && inserted.current_stock > 0) {
      await gate.supabase.from("inventory_movements").insert({
        inventory_item_id: inserted.id,
        change_quantity: inserted.current_stock,
        previous_stock: 0,
        new_stock: inserted.current_stock,
        movement_type: "restock",
        reason: "Initial stock upon item creation",
        created_by_user_id: userId,
      });
    }
  }

  revalidatePath("/admin");
  return { error: null, message: "Inventory item saved successfully." };
}

/**
 * Adjust inventory item stock with an audit reason
 */
export async function adjustStock(
  itemId: string,
  changeQuantity: number,
  reason: string,
  movementType: "restock" | "adjustment" | "waste" = "adjustment"
): Promise<InventoryActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const { userId } = await auth();

  if (!itemId) return { error: "Item ID is required." };
  if (!reason || reason.trim() === "") return { error: "Please provide a reason for the stock adjustment." };

  // Fetch current stock
  const { data: item, error: fetchErr } = await gate.supabase
    .from("inventory_items")
    .select("id, name, current_stock, unit, is_active")
    .eq("id", itemId)
    .single();

  if (fetchErr || !item) {
    return { error: "Inventory item not found." };
  }

  const check = validateStockAdjustment({
    currentStock: Number(item.current_stock),
    changeQuantity: Number(changeQuantity),
  });

  if (!check.valid || check.newStock === undefined) {
    return { error: check.error };
  }

  // Update stock
  const { error: updateErr } = await gate.supabase
    .from("inventory_items")
    .update({ current_stock: check.newStock, updated_at: new Date().toISOString() })
    .eq("id", itemId);

  if (updateErr) {
    return { error: "Failed to update stock: " + updateErr.message };
  }

  // Insert audit movement record
  await gate.supabase.from("inventory_movements").insert({
    inventory_item_id: itemId,
    change_quantity: changeQuantity,
    previous_stock: item.current_stock,
    new_stock: check.newStock,
    movement_type: movementType,
    reason: reason.trim(),
    created_by_user_id: userId,
  });

  revalidatePath("/admin");
  return {
    error: null,
    message: "Stock updated for " + item.name + ". New balance: " + check.newStock + " " + item.unit + ".",
  };
}

/**
 * Toggle active status of an inventory item
 */
export async function toggleInventoryItemActive(
  itemId: string,
  isActive: boolean
): Promise<InventoryActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const { error } = await gate.supabase
    .from("inventory_items")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", itemId);

  if (error) {
    return { error: "Failed to update item status." };
  }

  revalidatePath("/admin");
  return { error: null, message: "Item status updated." };
}

/**
 * Save product usage rule (recipe) for a service
 */
export async function saveServiceRecipe(formData: FormData): Promise<InventoryActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const serviceId = String(formData.get("serviceId") ?? "").trim();
  const inventoryItemId = String(formData.get("inventoryItemId") ?? "").trim();
  const quantity = Number(formData.get("quantity") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!serviceId || !inventoryItemId) {
    return { error: "Please select both a service and an inventory item." };
  }

  if (isNaN(quantity) || quantity <= 0) {
    return { error: "Quantity used per service must be greater than zero." };
  }

  // Upsert recipe record
  const { error } = await gate.supabase
    .from("service_inventory_recipes")
    .upsert(
      {
        service_id: serviceId,
        inventory_item_id: inventoryItemId,
        quantity,
        notes,
      },
      { onConflict: "service_id,inventory_item_id" }
    );

  if (error) {
    return { error: "Failed to save service recipe: " + error.message };
  }

  revalidatePath("/admin");
  return { error: null, message: "Product usage rule saved for service." };
}

/**
 * Delete a product usage rule from a service
 */
export async function deleteServiceRecipe(recipeId: string): Promise<InventoryActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const { error } = await gate.supabase
    .from("service_inventory_recipes")
    .delete()
    .eq("id", recipeId);

  if (error) {
    return { error: "Failed to remove recipe item." };
  }

  revalidatePath("/admin");
  return { error: null, message: "Usage rule removed." };
}

/**
 * Deduct inventory when an appointment is completed.
 * Features:
 * 1. Idempotency Guard: Checks appointment_inventory_deductions so completed bookings cannot be deducted twice.
 * 2. Pre-check: Verifies all recipe items have sufficient stock before deducting (prevents negative stock).
 * 3. Attribution: Links stock movements to the appointment, service, and assigned staff member.
 */
export async function deductInventoryForCompletedAppointment(
  appointmentId: string,
  callerUserId?: string
): Promise<InventoryActionResult> {
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
