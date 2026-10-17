-- ============================================================
-- Pre-Flight Verification Query for Migration C (Read-Only)
-- File: supabase/preflight/20261018000004_preflight_active_slot_duplicates.sql
--
-- Instructions: Run this SELECT query in the Supabase SQL Editor
-- BEFORE applying Migration C.
--
-- PURPOSE:
-- Migration C replaces the table-level constraint with:
--   CREATE UNIQUE INDEX idx_appointments_active_slots 
--   ON appointments (appointment_date, appointment_time, staff_id) 
--   WHERE status <> 'cancelled';
--
-- If there are any existing duplicates among non-cancelled appointments,
-- creating the index will fail and abort the migration.
--
-- EXPECTED RESULT: 0 rows returned.
-- If any rows are returned, STOP and resolve conflicting bookings
-- before running Migration C.
-- ============================================================

-- 1. Identify any active (non-cancelled) duplicate slot groups
SELECT 
    appointment_date,
    appointment_time,
    staff_id,
    COUNT(*) AS active_duplicate_count,
    array_agg(id) AS duplicate_appointment_ids,
    array_agg(status) AS statuses
FROM public.appointments
WHERE status <> 'cancelled'
GROUP BY appointment_date, appointment_time, staff_id
HAVING COUNT(*) > 1;

-- 2. Detailed view of conflicting active appointments (if any exist)
SELECT 
    a.id,
    a.appointment_date,
    a.appointment_time,
    a.staff_id,
    a.status,
    a.customer_id,
    a.full_name,
    a.email,
    a.created_at
FROM public.appointments a
INNER JOIN (
    SELECT appointment_date, appointment_time, staff_id
    FROM public.appointments
    WHERE status <> 'cancelled'
    GROUP BY appointment_date, appointment_time, staff_id
    HAVING COUNT(*) > 1
) dupes ON a.appointment_date = dupes.appointment_date
       AND a.appointment_time = dupes.appointment_time
       AND (a.staff_id = dupes.staff_id OR (a.staff_id IS NULL AND dupes.staff_id IS NULL))
WHERE a.status <> 'cancelled'
ORDER BY a.appointment_date, a.appointment_time, a.staff_id, a.created_at;
