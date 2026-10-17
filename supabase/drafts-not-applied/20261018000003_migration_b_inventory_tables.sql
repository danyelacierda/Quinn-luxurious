-- ============================================================
-- Migration B: Inventory Management Tables & Zero-Policy RLS Lockdown
-- File: supabase/migrations/20261018000003_migration_b_inventory_tables.sql
--
-- PURPOSE:
-- 1. Create inventory_items, service_inventory_recipes, inventory_movements,
--    and appointment_inventory_deductions tables matching application code.
-- 2. Lock down all four tables with Row Level Security (RLS) and ZERO public
--    policies so all reads and writes are restricted exclusively to the
--    server-side Supabase admin client (service_role).
-- 3. Use text for created_by_user_id without foreign key constraints, ensuring
--    full compatibility with Clerk user identifiers (e.g. "user_2t...").
-- 4. Provide a UNIQUE constraint on appointment_inventory_deductions(appointment_id)
--    so double-completions can never deduct stock twice.
--
-- PROPERTIES:
-- - Idempotent (CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS)
-- - Wrapped in a single transaction (BEGIN ... COMMIT)
-- - Completely independent from Migration A (can be applied or rolled back alone)
-- ============================================================

BEGIN;

-- 1. INVENTORY ITEMS (Supplies, Consumables & Retail)
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text UNIQUE,
  category text NOT NULL DEFAULT 'Consumables',
  unit text NOT NULL DEFAULT 'pcs',
  current_stock numeric(10,2) NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  low_stock_threshold numeric(10,2) NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  cost_per_unit numeric(10,2) DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. SERVICE INVENTORY RECIPES (Products consumed per service)
CREATE TABLE IF NOT EXISTS public.service_inventory_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity numeric(10,2) NOT NULL CHECK (quantity > 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_inventory_recipes_service_item_unique UNIQUE (service_id, inventory_item_id)
);

-- 3. INVENTORY MOVEMENTS (Immutable audit trail of stock changes)
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  change_quantity numeric(10,2) NOT NULL,
  previous_stock numeric(10,2) NOT NULL,
  new_stock numeric(10,2) NOT NULL CHECK (new_stock >= 0),
  movement_type text NOT NULL CHECK (movement_type IN ('restock', 'adjustment', 'service_consumption', 'waste', 'cancellation_return')),
  reason text NOT NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  created_by_user_id text, -- Type compatible with Clerk user strings, no foreign key
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. APPOINTMENT INVENTORY DEDUCTIONS (Duplicate Deduction Guard)
CREATE TABLE IF NOT EXISTS public.appointment_inventory_deductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  deducted_at timestamptz NOT NULL DEFAULT now()
);

-- 5. PERFORMANCE & AUDIT INDEXES
CREATE INDEX IF NOT EXISTS idx_inventory_movements_item ON public.inventory_movements(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_appt ON public.inventory_movements(appointment_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_staff ON public.inventory_movements(staff_id);
CREATE INDEX IF NOT EXISTS idx_service_recipes_service ON public.service_inventory_recipes(service_id);

-- 6. ROW LEVEL SECURITY (RLS) LOCKDOWN
-- Enabling RLS with ZERO policies ensures default-deny for all anon/authenticated callers.
-- All operations are performed exclusively via the backend service_role admin client.
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_inventory_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_inventory_deductions ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================
-- MATCHING ROLLBACK SCRIPT FOR MIGRATION B
--
-- Instructions: Run the SQL block below in Supabase SQL Editor
-- to completely revert Migration B.
--
-- WARNING: Dropping these tables permanently deletes all inventory
-- catalog items, configured service recipes, audit movement logs,
-- and appointment deduction records.
-- ============================================================
/*
BEGIN;

DROP TABLE IF EXISTS public.appointment_inventory_deductions CASCADE;
DROP TABLE IF EXISTS public.inventory_movements CASCADE;
DROP TABLE IF EXISTS public.service_inventory_recipes CASCADE;
DROP TABLE IF EXISTS public.inventory_items CASCADE;

COMMIT;
*/
