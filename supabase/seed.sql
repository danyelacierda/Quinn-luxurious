-- Seed data — migrates the placeholder content that was previously hardcoded
-- in lib/data.ts, so the site isn't empty on first run.
-- Run this after 0001_init.sql. Safe to edit or re-run (uses `on conflict do nothing`
-- keyed by name where practical — but since this is meant to run once on a fresh
-- database, duplicate runs will insert duplicates for tables without a unique name
-- constraint. Truncate first if you need to re-seed.)

insert into services (category, name, description, duration_minutes, price) values
  ('Eyelash Extensions', 'Eyelash Extensions', 'Classic, hybrid, or volume sets applied lash-by-lash for a soft, natural curl that lasts.', 120, 145.00),
  ('Lash Lift', 'Lash Lift', 'A gentle, low-maintenance curl that lifts your natural lashes for weeks of effortless definition.', 60, 85.00),
  ('Nails', 'Nail Services', 'Manicures and pedicures finished with precision shaping, cuticle care, and a flawless polish.', 60, 55.00),
  ('Nails', 'Nail Art', 'Hand-painted detail, inlay, and 3D accents — custom design work for a one-of-a-kind manicure.', 45, 25.00),
  ('Lash Lift', 'Brow Lamination', 'Fuller-looking, perfectly groomed brows with a smooth, feathered finish that holds for weeks.', 50, 75.00),
  ('Nails', 'Gel Extensions', 'Sculpted length and structure with a durable, glossy gel finish tailored to your shape.', 90, 95.00);

insert into staff (full_name, role_title, bio, is_active) values
  ('Quinn Santos', 'Founder & Lead Lash Artist', 'Specializes in volume and mega-volume sets.', true),
  ('Mars Villanueva', 'Senior Nail Technician', 'Specializes in gel extensions and nail art.', true),
  ('Ella Ramos', 'Lash Lift Specialist', 'Specializes in lash lift and tint.', true);

insert into gallery (category, image_url, caption, sort_order) values
  ('Eyelash Extensions', 'https://images.unsplash.com/photo-1583001931096-959e9a1a6223?q=80&w=800', 'Volume Lash Set', 1),
  ('Nails', 'https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=800', 'Chrome Nail Art', 2),
  ('Eyelash Extensions', 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?q=80&w=800', 'Classic Lash Extensions', 3),
  ('Nails', 'https://images.unsplash.com/photo-1604902396830-aca29e19b067?q=80&w=800', 'Hand-Painted Florals', 4),
  ('Lash Lift', 'https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=800', 'Lash Lift & Tint', 5),
  ('Nails', 'https://images.unsplash.com/photo-1610992015732-2449b76344bc?q=80&w=800', 'Studio Interior', 6);

insert into reviews (full_name, rating, review_text) values
  ('Ariana M.', 5, 'The most relaxing, precise lash appointment I''ve had. My set looked natural for weeks.'),
  ('Priya K.', 5, 'Quinn Luxurious is my monthly ritual now. The attention to detail on my nail art is unmatched.'),
  ('Sofia R.', 5, 'Effortless mornings ever since. The studio feels like a private retreat, not a salon chain.');

insert into promotions (title, description, discount_code, discount_percent, is_active) values
  ('New Client Welcome', 'Take 15% off your first visit with us.', 'WELCOME15', 15.00, true);

-- To create your first admin account:
-- 1. Sign up normally through the site's /signup page (this creates the auth.users
--    row and, via the trigger, a matching public.users row with role='customer').
-- 2. Then run, replacing the email:
--      update public.users set role = 'admin' where email = 'you@example.com';
