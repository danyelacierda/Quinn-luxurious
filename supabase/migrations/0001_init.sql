-- Quinn Luxurious — initial schema
-- Run this in Supabase → SQL Editor, or via `supabase db push` if using the CLI.

create extension if not exists "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

-- USERS (customers, staff, and admin accounts — one row per auth.users row)
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text unique not null,
  phone text,
  role text not null default 'customer' check (role in ('customer','staff','admin')),
  created_at timestamptz not null default now()
);

-- STAFF (public-facing profile info for staff members)
create table staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  full_name text not null,
  role_title text,
  bio text,
  photo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- SERVICES
create table services (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('Eyelash Extensions','Lash Lift','Nails')),
  name text not null,
  description text,
  duration_minutes int not null,
  price numeric(10,2) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- APPOINTMENTS
create table appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references users(id) on delete set null,
  service_id uuid references services(id) on delete restrict not null,
  staff_id uuid references staff(id) on delete set null,
  appointment_date date not null,
  appointment_time text not null,
  status text not null default 'confirmed' check (status in ('confirmed','completed','cancelled')),
  full_name text not null,
  phone text not null,
  email text not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (appointment_date, appointment_time, staff_id)
);

-- REVIEWS
create table reviews (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references users(id) on delete set null,
  full_name text not null,
  rating int not null check (rating between 1 and 5),
  review_text text not null,
  created_at timestamptz not null default now()
);

-- GALLERY
create table gallery (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  image_url text not null,
  caption text,
  sort_order int default 0,
  created_at timestamptz not null default now()
);

-- PROMOTIONS
create table promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  discount_code text,
  discount_percent numeric(5,2),
  starts_at date,
  ends_at date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_appointments_customer on appointments(customer_id);
create index idx_appointments_date on appointments(appointment_date);
create index idx_appointments_staff_date on appointments(staff_id, appointment_date);

-- ============================================================
-- AUTH TRIGGER — auto-create a `users` row on signup
-- ============================================================
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, full_name, email, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'phone',
    'customer'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table users enable row level security;
alter table staff enable row level security;
alter table services enable row level security;
alter table appointments enable row level security;
alter table reviews enable row level security;
alter table gallery enable row level security;
alter table promotions enable row level security;

-- Small helper: is the current user staff or admin?
create function public.is_staff_or_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role in ('staff','admin')
  );
$$;

create function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------- users ----------
create policy "users can read own row" on users
  for select using (auth.uid() = id);
create policy "users can update own row" on users
  for update using (auth.uid() = id);
create policy "admins can read all users" on users
  for select using (public.is_admin());
create policy "admins can update all users" on users
  for update using (public.is_admin());

-- ---------- staff ----------
create policy "public can read active staff" on staff
  for select using (is_active = true);
create policy "admins can read all staff" on staff
  for select using (public.is_admin());
create policy "admins can write staff" on staff
  for insert with check (public.is_admin());
create policy "admins can update staff" on staff
  for update using (public.is_admin());
create policy "admins can delete staff" on staff
  for delete using (public.is_admin());

-- ---------- services ----------
create policy "public can read active services" on services
  for select using (is_active = true);
create policy "admins can read all services" on services
  for select using (public.is_admin());
create policy "admins can write services" on services
  for insert with check (public.is_admin());
create policy "admins can update services" on services
  for update using (public.is_admin());
create policy "admins can delete services" on services
  for delete using (public.is_admin());

-- ---------- appointments ----------
create policy "customers can read own appointments" on appointments
  for select using (
    auth.uid() = customer_id
    or email = (select email from public.users where id = auth.uid())
  );
create policy "staff can read all appointments" on appointments
  for select using (public.is_staff_or_admin());
create policy "anyone can create an appointment" on appointments
  for insert with check (true);
create policy "customers can update own appointments" on appointments
  for update using (auth.uid() = customer_id);
create policy "staff can update all appointments" on appointments
  for update using (public.is_staff_or_admin());

-- ---------- reviews ----------
create policy "public can read reviews" on reviews
  for select using (true);
create policy "authenticated users can create reviews" on reviews
  for insert with check (auth.uid() = customer_id);
create policy "admins can moderate reviews" on reviews
  for delete using (public.is_admin());

-- ---------- gallery ----------
create policy "public can read gallery" on gallery
  for select using (true);
create policy "admins can write gallery" on gallery
  for insert with check (public.is_admin());
create policy "admins can update gallery" on gallery
  for update using (public.is_admin());
create policy "admins can delete gallery" on gallery
  for delete using (public.is_admin());

-- ---------- promotions ----------
create policy "public can read active promotions" on promotions
  for select using (is_active = true);
create policy "admins can read all promotions" on promotions
  for select using (public.is_admin());
create policy "admins can write promotions" on promotions
  for insert with check (public.is_admin());
create policy "admins can update promotions" on promotions
  for update using (public.is_admin());
create policy "admins can delete promotions" on promotions
  for delete using (public.is_admin());
