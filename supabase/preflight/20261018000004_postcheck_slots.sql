-- ============================================================
-- Post-Check Verification Queries for Migration C (Read-Only)
-- File: supabase/preflight/20261018000004_postcheck_slots.sql
--
-- Instructions: Run these SELECT queries in the Supabase SQL Editor
-- AFTER applying Migration C to verify:
-- 1. All unique constraints currently defined on public.appointments.
-- 2. All unique indexes (including partial unique indexes) on public.appointments.
-- 3. That appointments.status is defined as NOT NULL and has 0 null rows.
-- ============================================================

-- 1. List all UNIQUE constraints on public.appointments
SELECT 
    c.conname AS constraint_name,
    c.contype AS constraint_type,
    pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND t.relname = 'appointments'
  AND c.contype = 'u'
ORDER BY c.conname;

-- 2. List all UNIQUE indexes on public.appointments (including partial unique indexes)
SELECT 
    i.relname AS index_name,
    pg_get_indexdef(i.oid) AS index_definition
FROM pg_index x
JOIN pg_class i ON i.oid = x.indexrelid
JOIN pg_class t ON t.oid = x.indrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'appointments'
  AND x.indisunique = true
ORDER BY i.relname;

-- 3. Check that appointments.status column schema definition is NOT NULL
SELECT 
    table_name,
    column_name,
    is_nullable,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'appointments'
  AND column_name = 'status';

-- 4. Verify that 0 rows exist in appointments with status IS NULL
SELECT 
    COUNT(*) AS null_status_count
FROM public.appointments
WHERE status IS NULL;
