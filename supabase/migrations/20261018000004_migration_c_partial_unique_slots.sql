-- ============================================================
-- Migration C: Partial Unique Index for Active Appointment Slots
-- File: supabase/migrations/20261018000004_migration_c_partial_unique_slots.sql
--
-- PURPOSE:
-- Replace the table-level UNIQUE constraint on appointments:
--   unique (appointment_date, appointment_time, staff_id)
-- with a partial UNIQUE index that enforces slot uniqueness ONLY on
-- active bookings (WHERE status <> 'cancelled').
--
-- WHY THIS IS NEEDED:
-- The original table-level constraint applied to ALL rows including cancelled
-- appointments. When a customer or staff member cancelled an appointment,
-- the time slot remained blocked at the database constraint level, preventing
-- new bookings for that same slot. This partial unique index frees cancelled
-- slots for immediate rebooking while preventing double-bookings among active slots.
--
-- CONSTRAINT NAME NOTE:
-- In 0001_init.sql, the constraint was defined anonymously as:
--   unique (appointment_date, appointment_time, staff_id)
-- PostgreSQL defaults anonymous multi-column unique constraints to:
--   <table>_<col1>_<col2>_<col3>_key
-- which is: appointments_appointment_date_appointment_time_staff_id_key.
-- IMPORTANT: Confirm this constraint name on production using:
--   SELECT conname FROM pg_constraint
--   WHERE conrelid = 'public.appointments'::regclass AND contype = 'u';
--
-- PROPERTIES:
-- - Wrapped in a single transaction (BEGIN ... COMMIT)
-- - Idempotent (DROP CONSTRAINT IF EXISTS, CREATE UNIQUE INDEX IF NOT EXISTS)
-- - Completely non-destructive to existing row data
-- ============================================================

BEGIN;

-- 1. Drop the legacy table-level unique constraint (blocks cancelled slots)
ALTER TABLE public.appointments 
  DROP CONSTRAINT IF EXISTS appointments_appointment_date_appointment_time_staff_id_key;

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
