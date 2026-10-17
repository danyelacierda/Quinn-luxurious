-- Additive migration for Stripe test-mode payments
-- Safe, non-destructive migration. Does not drop or modify existing columns or policies.
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS stripe_session_id text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

-- Create index for fast webhook session lookups
CREATE INDEX IF NOT EXISTS idx_appointments_stripe_session_id ON public.appointments(stripe_session_id);
