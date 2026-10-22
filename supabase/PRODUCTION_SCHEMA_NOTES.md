# Production Schema Notes (PostgreSQL / Supabase)

> **CRITICAL WARNING FOR DEVELOPERS & DEPLOYMENTS:**
> The repository file `supabase/migrations/0001_init.sql` is a historical initialization baseline and **does NOT reflect the actual live state of the production database**.
> Do not attempt to re-run or rely on `0001_init.sql` or the drafted migrations in `supabase/drafts-not-applied/`.

A live audit of the production database confirmed the following active schema definitions, constraints, indexes, and legacy columns:

---

## 1. `appointments` Table Schema & Constraints

### Stripe Integration Columns (Active in Production)
- `stripe_session_id text` (nullable): Stored Stripe Checkout Session ID (`cs_test_...` or `cs_live_...`).
- `stripe_payment_intent_id text` (nullable): Stored Stripe Payment Intent ID (`pi_...`).
- `needs_refund boolean` (nullable/default false): Flagged by webhooks or the success page when a payment was collected after an appointment was cancelled or expired, and its slot was taken by another client.

### Legacy PayMongo Columns (Do Not Use)
- Columns matching `paymongo_*` (e.g. `paymongo_checkout_session_id`, `paymongo_payment_intent_id`) are leftover historical artifacts from a previous PayMongo payment integration.
- These columns remain in production for historical data integrity, but application code must not write to or depend on them.

### `payment_status` Check Constraint
- The production constraint on `payment_status` already supports test-mode and live lifecycle states:
  ```sql
  CHECK (payment_status IN ('pending', 'partial', 'fully_paid', 'refunded', 'expired', 'failed'))
  ```

### Unique Indexes on `appointments`
Production enforces uniqueness via two partial unique indexes:

1. **Active Time Slot Protection (`appointments_no_double_booking`)**:
   ```sql
   CREATE UNIQUE INDEX appointments_no_double_booking 
   ON public.appointments (appointment_date, appointment_time, COALESCE(staff_id::text, 'unassigned')) 
   WHERE status IN ('pending', 'pending_payment', 'confirmed', 'completed');
   ```
   - **Behavior**: Ensures that an artist or unassigned slot cannot be double-booked across active states. Cancelled appointments (`status = 'cancelled'`) are excluded, freeing the slot immediately for rebooking.
   - **Application Error Handling**: When a booking or confirmation hits Postgres error code `23505` and mentions `appointments_no_double_booking`, it is treated as a slot conflict. If paid, it triggers the refund workflow (`needs_refund = true`).

2. **Payment Reference Uniqueness (`appointments_payment_reference_idx`)**:
   ```sql
   CREATE UNIQUE INDEX appointments_payment_reference_idx 
   ON public.appointments (payment_reference) 
   WHERE payment_reference IS NOT NULL;
   ```
   - **Behavior**: Ensures that no two appointments can share the same non-null `payment_reference` (e.g., Stripe Payment Intent ID or QR Ph transaction reference).
   - **Application Error Handling**: A `23505` error violating this index is a duplicate reference error, NOT a slot conflict. It must log the appointment ID, return HTTP 500 from webhooks, and not set `needs_refund`.

---

## 2. Inventory System Tables (Active in Production)

Production contains all four inventory tables supporting the salon management system:
1. `inventory_products`
2. `inventory_movements`
3. `service_product_recipes`
4. `appointment_inventory_deductions`

### Row Level Security (RLS)
- RLS is **ENABLED** on all four inventory tables in production.
- **Zero public access policies** exist on these tables.
- All inventory reads, stock deductions, and audit logging are executed server-side via the elevated `supabaseAdmin` service-role client (`lib/supabase/server.ts`). Ordinary client/anon access is blocked at the database engine level.

---

## 3. Status of Draft Migrations

- The three draft migrations originally created during the Phase 1 security audit:
  - `20261018000002_migration_a_stripe_and_payment_status.sql`
  - `20261018000003_migration_b_inventory_tables.sql`
  - `20261018000004_migration_c_partial_unique_slots.sql`
- Have been moved to `supabase/drafts-not-applied/`.
- **THEY MUST NOT BE APPLIED TO PRODUCTION**, as production already includes these schema elements.
