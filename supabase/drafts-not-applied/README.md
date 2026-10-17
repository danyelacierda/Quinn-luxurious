# Unapplied Draft Migrations (DO NOT APPLY)

> **DO NOT APPLY THESE MIGRATIONS TO ANY ENVIRONMENT (PRODUCTION OR STAGING).**

These migration files (Migration A, B, and C) were drafted locally based on an outdated database audit of `0001_init.sql`.
A live inspection of production confirmed that all of these changes are **already present** in the live production database:

1. **Migration A (Stripe columns & payment_status)**:
   - Production already contains `stripe_session_id text` and `stripe_payment_intent_id text` on `appointments`.
   - Production already contains the `needs_refund` column.
   - Production already contains the updated `payment_status` check constraint permitting `'expired'` and `'failed'` alongside standard values.

2. **Migration B (Inventory tables)**:
   - Production already contains all four inventory tables (`inventory_products`, `inventory_movements`, `service_product_recipes`, and `appointment_inventory_deductions`).
   - Production already has Row Level Security (RLS) enabled on all four tables with zero public access policies (locked down strictly for `supabaseAdmin` service-role access).

3. **Migration C (Partial slot index)**:
   - Production already contains the partial unique index:
     ```sql
     CREATE UNIQUE INDEX appointments_no_double_booking 
     ON appointments (appointment_date, appointment_time, COALESCE(staff_id::text, 'unassigned')) 
     WHERE status IN ('pending', 'pending_payment', 'confirmed', 'completed');
     ```
   - Production also contains the unique index on payment references:
     ```sql
     CREATE UNIQUE INDEX appointments_payment_reference_idx 
     ON appointments (payment_reference) 
     WHERE payment_reference IS NOT NULL;
     ```

These were drafted from an outdated audit, production already has these changes, do NOT apply them. They are retained here strictly for reference.
