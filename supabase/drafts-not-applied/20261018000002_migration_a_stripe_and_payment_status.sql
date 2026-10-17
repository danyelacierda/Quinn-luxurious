-- ============================================================
-- Migration A: Stripe Columns & payment_status Expansion (Urgent)
-- File: supabase/migrations/20261018000002_migration_a_stripe_and_payment_status.sql
--
-- PURPOSE:
-- 1. Add stripe_session_id (text) and stripe_payment_intent_id (text) to appointments.
-- 2. Add partial index on stripe_session_id (WHERE stripe_session_id IS NOT NULL).
-- 3. Drop and recreate appointments_payment_status_check to allow:
--    'pending', 'deposit_paid', 'fully_paid', 'refunded', 'expired', 'failed'.
--
-- PROPERTIES:
-- - Idempotent (ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, DROP CONSTRAINT IF EXISTS)
-- - Wrapped in a single transaction (BEGIN ... COMMIT)
-- - Zero changes to existing row data
-- - Independent from Migration B (can be applied and rolled back alone)
-- ============================================================

BEGIN;

-- 1. Add Stripe session and payment intent columns to appointments table
ALTER TABLE public.appointments 
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

-- 2. Add partial index on stripe_session_id for high-performance webhook lookups
CREATE INDEX IF NOT EXISTS idx_appointments_stripe_session_id 
  ON public.appointments (stripe_session_id) 
  WHERE stripe_session_id IS NOT NULL;

-- 3. Drop existing 4-value payment_status check constraint
ALTER TABLE public.appointments 
  DROP CONSTRAINT IF EXISTS appointments_payment_status_check;

-- 4. Recreate payment_status check constraint with expanded 6 values
ALTER TABLE public.appointments 
  ADD CONSTRAINT appointments_payment_status_check 
  CHECK (payment_status IN (
    'pending', 
    'deposit_paid', 
    'fully_paid', 
    'refunded', 
    'expired', 
    'failed'
  ));

COMMIT;

-- ============================================================
-- MATCHING ROLLBACK SCRIPT FOR MIGRATION A
--
-- Instructions: Run the SQL block below in Supabase SQL Editor
-- to completely revert Migration A.
--
-- SAFETY NOTICE ON ROLLBACK:
-- If the application has written any rows with payment_status = 'expired'
-- or 'failed', attempting to restore the original 4-value check constraint
-- immediately would violate the constraint and cause PostgreSQL to abort
-- the rollback with a check_violation error (23514).
--
-- To guarantee the rollback cannot fail midway, Step 1 updates any rows
-- currently using 'expired' or 'failed' back to 'pending' before re-creating
-- the original 4-value constraint.
-- ============================================================
/*
BEGIN;

-- 1. Handle rows using 'expired' or 'failed' so constraint re-creation cannot fail midway
UPDATE public.appointments 
SET payment_status = 'pending' 
WHERE payment_status IN ('expired', 'failed');

-- 2. Drop the expanded check constraint
ALTER TABLE public.appointments 
  DROP CONSTRAINT IF EXISTS appointments_payment_status_check;

-- 3. Restore the original 4-value check constraint
ALTER TABLE public.appointments 
  ADD CONSTRAINT appointments_payment_status_check 
  CHECK (payment_status IN ('pending', 'deposit_paid', 'fully_paid', 'refunded'));

-- 4. Drop the partial index on stripe_session_id
DROP INDEX IF EXISTS public.idx_appointments_stripe_session_id;

-- 5. Drop the Stripe tracking columns
ALTER TABLE public.appointments 
  DROP COLUMN IF EXISTS stripe_session_id,
  DROP COLUMN IF EXISTS stripe_payment_intent_id;

COMMIT;
*/
