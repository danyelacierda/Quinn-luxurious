-- ============================================================
-- Pre-Flight Verification Queries (Read-Only)
-- File: supabase/migrations/20261018000001_preflight_checks.sql
--
-- Instructions: Run these SELECT queries in the Supabase SQL Editor
-- before applying Migration A or Migration B.
-- No modifications or side effects are performed.
-- ============================================================

-- 1. Check current payment_status check constraint name and definition on appointments
SELECT 
    c.conname AS constraint_name,
    pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE t.relname = 'appointments'
  AND n.nspname = 'public'
  AND c.conname LIKE '%payment_status%';

-- 2. Row count per payment_status in appointments
SELECT 
    COALESCE(payment_status, 'NULL') AS payment_status,
    COUNT(*) AS appointment_count
FROM public.appointments
GROUP BY payment_status
ORDER BY appointment_count DESC;

-- 3. Count of pending_payment appointments older than 30 minutes
SELECT 
    COUNT(*) AS expired_pending_payment_count
FROM public.appointments
WHERE status = 'pending_payment'
  AND created_at < NOW() - INTERVAL '30 minutes';

-- 4. Check existence of the four inventory tables in public schema
SELECT 
    t.table_name,
    EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name = t.table_name
    ) AS table_exists
FROM (
    VALUES 
        ('inventory_items'),
        ('service_inventory_recipes'),
        ('inventory_movements'),
        ('appointment_inventory_deductions')
) AS t(table_name);
