# Quinn Luxurious — Step 5: Inventory Management Setup Guide

This document details the inventory architecture, service consumption recipes, safe stock deduction mechanisms, and database requirements implemented in **Step 5: Inventory Management**.

---

## 1. Inventory Architecture & Data Model

The system introduces an audit-compliant, relational inventory tracking architecture:

1. **`inventory_items` (Supplies & Consumables Catalog):**
   - Stores all salon products (lash trays, glues, primers, eye pads, nail polishes, sanitizers).
   - Tracks `current_stock`, `unit` (pcs, ml, pairs, trays), `low_stock_threshold`, and `is_active`.
   - Guaranteed non-negative stock via check constraint `check (current_stock >= 0)`.

2. **`service_inventory_recipes` (Products Used Per Service):**
   - Connects each salon service (`services`) to the inventory items it consumes.
   - Defines `quantity` consumed per appointment (e.g. 1 pair of eye pads, 0.5 ml of adhesive per Volume Lash Set).
   - Can be adjusted or corrected by administrators at any time without altering past stock movements.

3. **`inventory_movements` (Immutable Stock Audit Ledger):**
   - Every stock addition, count adjustment, damage/waste write-off, and appointment service consumption is recorded here.
   - Captures: `previous_stock`, `change_quantity`, `new_stock`, `movement_type`, `reason`.
   - **Full Staff & Appointment Attribution:** Automatically stores `appointment_id`, `service_id`, and `staff_id` so salon administrators can audit which team member consumed which supplies for each customer appointment.

4. **`appointment_inventory_deductions` (Idempotency & Concurrency Guard):**
   - Ensures an appointment's products are deducted **at most once**.
   - Enforced by a unique constraint on `appointment_id`.
   - Retries or repeated clicks on "Mark Completed" safely detect existing deductions and exit without double deduction.

---

## 2. Safe Stock Deduction Process

### Workflow & Trigger Point:
- Inventory is deducted when an appointment reaches `status === "completed"` (either by an administrator in the admin dashboard or by an assigned staff member in the staff portal).
- **Pre-check:** Before updating stock, the system verifies that all required recipe items have sufficient available stock (`current_stock >= required_quantity`).
- **Insufficient Stock Protection:** If any required supply is lacking, the completion action **aborts** with an informative error (e.g. `"Insufficient stock for Lash Glue. Required: 0.5 ml, Available: 0.2 ml. Please restock before completing this appointment."`). This prevents silent negative stock and partial/corrupted deductions.
- **Cancellation Policy:** Cancelling an appointment does **not** automatically restore stock unless it is verified that the products were not used (preventing fabricated stock counts if services were already rendered).

---

## 3. Database Migration Setup (For Review Only)

The additive review-only migration file is located at:
`supabase/migrations/20261017_add_inventory_tables.sql`

### SQL Objects Created:
- `inventory_items`
- `service_inventory_recipes`
- `inventory_movements`
- `appointment_inventory_deductions`
- Postgres RPC `deduct_inventory_for_appointment(p_appointment_id uuid, p_user_id text)` with row-level locking (`FOR UPDATE`).

### Manual Supabase Setup (When Ready to Deploy):
1. In the Supabase SQL Editor, run `supabase/migrations/20261017_add_inventory_tables.sql`.
2. Seed initial supplies (e.g. adhesives, eye pads, nail gels) using the Admin Inventory Tab.
3. Configure consumption rules under **Admin -> Inventory -> Service Usage**.

---

## 4. Testing & Verification

### Code-Level Automated Tests (`tests/inventory.test.mjs`):
- Input validation (rejects empty names, negative initial stock, negative thresholds).
- Stock adjustments (correct addition/deductions, non-zero checks, negative stock rejection).
- Low-stock threshold alert calculations.
- Idempotent appointment deductions (prevents double deductions on retry).
- Insufficient stock handling (aborts and preserves stock without creating negative values).
- Staff and appointment attribution on movement records.

### Database-Level Integration Notes:
- While code-level tests verify business logic deterministically, true concurrent row-level locking (`SELECT ... FOR UPDATE`) and PostgreSQL transaction rollbacks require active integration with the remote PostgreSQL database.
