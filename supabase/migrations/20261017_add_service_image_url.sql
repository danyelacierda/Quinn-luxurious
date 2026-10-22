-- Additive migration: Support service photography
-- Safe, non-destructive migration. Does not drop or modify existing columns.
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS image_url text;
