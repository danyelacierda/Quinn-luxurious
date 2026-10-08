-- Add a partial unique index to prevent double booking of the exact same slot.
-- Using COALESCE on staff_id to handle null values gracefully.
-- The index only applies to active bookings (pending, pending_payment, confirmed, completed).

CREATE UNIQUE INDEX IF NOT EXISTS appointments_no_double_booking 
ON appointments (appointment_date, appointment_time, COALESCE(staff_id::text, 'unassigned')) 
WHERE status IN ('pending','pending_payment','confirmed','completed');
