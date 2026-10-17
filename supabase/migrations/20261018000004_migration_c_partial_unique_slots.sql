-- ============================================================
-- Migration C: Partial Unique Index for Active Appointment Slots
-- File: supabase/migrations/20261018000004_migration_c_partial_unique_slots.sql
--
-- PURPOSE:
-- Replace any table-level UNIQUE constraint on appointments:
--   (appointment_date, appointment_time, staff_id)
-- with a partial UNIQUE index that enforces slot uniqueness ONLY on
-- active bookings (WHERE status <> 'cancelled').
--
-- WHY THIS IS NEEDED:
-- The original table-level constraint applied to ALL rows including cancelled
-- appointments. When an appointment was cancelled, the slot remained blocked
-- at the database constraint level. This partial unique index frees cancelled
-- slots for immediate rebooking while preventing double-bookings among active slots.
--
-- DYNAMIC CONSTRAINT DROP (BY COLUMNS):
-- Rather than assuming a hardcoded constraint name (which can vary depending on
-- PostgreSQL version, initial migration history, or custom names in production),
-- Step 1 dynamically queries pg_constraint + conkey to find any UNIQUE ('u')
-- constraint on public.appointments whose column names match exactly
-- (appointment_date, appointment_time, staff_id), and drops it via EXECUTE format(%I).
--
-- PROPERTIES:
-- - Wrapped in a single transaction (BEGIN ... COMMIT)
-- - Idempotent
-- - Completely non-destructive to existing row data
-- ============================================================

BEGIN;

-- 1. Dynamically find and drop any unique constraint on (appointment_date, appointment_time, staff_id)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public'
          AND t.relname = 'appointments'
          AND c.contype = 'u'
          AND (
              SELECT array_agg(a.attname::text ORDER BY a.attname::text)
              FROM pg_attribute a
              WHERE a.attrelid = c.conrelid
                AND a.attnum = ANY(c.conkey)
          ) = ARRAY['appointment_date', 'appointment_time', 'staff_id']
    LOOP
        EXECUTE format('ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;
END $$;

-- 2. Create the partial unique index that excludes cancelled appointments
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_active_slots 
  ON public.appointments (appointment_date, appointment_time, staff_id) 
  WHERE status <> 'cancelled';

COMMIT;

-- ============================================================
-- MATCHING ROLLBACK SCRIPT FOR MIGRATION C
--
-- Instructions: Run the SQL block below in Supabase SQL Editor
-- to completely revert Migration C.
--
-- ROLLBACK FAILURE WARNING:
-- Migration C permits multiple cancelled appointments for the same
-- (appointment_date, appointment_time, staff_id) tuple.
-- If any cancelled duplicates exist when rolling back, re-adding the original
-- table-level unique constraint WILL FAIL with code 23505 (unique_violation).
--
-- Before rolling back, run the pre-check query below to verify no duplicates exist:
--
--   SELECT appointment_date, appointment_time, staff_id, COUNT(*)
--   FROM public.appointments
--   GROUP BY appointment_date, appointment_time, staff_id
--   HAVING COUNT(*) > 1;
--
-- If duplicates are found, they must be resolved or deleted before the rollback
-- transaction can succeed.
-- ============================================================
/*
BEGIN;

-- 1. Drop the partial unique index
DROP INDEX IF EXISTS public.idx_appointments_active_slots;

-- 2. Restore the original table-level unique constraint
ALTER TABLE public.appointments 
  ADD CONSTRAINT appointments_appointment_date_appointment_time_staff_id_key 
  UNIQUE (appointment_date, appointment_time, staff_id);

COMMIT;
*/
