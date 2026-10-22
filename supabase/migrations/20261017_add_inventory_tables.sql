-- ============================================================
-- Quinn Luxurious — Step 5: Inventory & Product Usage Schema
-- Review-Only Migration (Do NOT apply directly to production without instructor review)
-- ============================================================

-- 1. INVENTORY ITEMS (Salon Supplies, Consumables & Retail Products)
create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique,
  category text not null default 'Consumables',
  unit text not null default 'pcs', -- 'pcs', 'ml', 'pairs', 'trays', 'bottles', 'sets'
  current_stock numeric(10,2) not null default 0 check (current_stock >= 0),
  low_stock_threshold numeric(10,2) not null default 5 check (low_stock_threshold >= 0),
  cost_per_unit numeric(10,2) default 0,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. SERVICE INVENTORY RECIPES (Products used per service)
create table if not exists service_inventory_recipes (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id) on delete restrict,
  quantity numeric(10,2) not null check (quantity > 0),
  notes text,
  created_at timestamptz not null default now(),
  unique(service_id, inventory_item_id)
);

-- 3. INVENTORY MOVEMENTS (Immutable stock audit trail)
create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references inventory_items(id) on delete restrict,
  change_quantity numeric(10,2) not null,
  previous_stock numeric(10,2) not null,
  new_stock numeric(10,2) not null check (new_stock >= 0),
  movement_type text not null check (movement_type in ('restock', 'adjustment', 'service_consumption', 'waste', 'cancellation_return')),
  reason text not null,
  appointment_id uuid references appointments(id) on delete set null,
  service_id uuid references services(id) on delete set null,
  staff_id uuid references staff(id) on delete set null,
  created_by_user_id text,
  created_at timestamptz not null default now()
);

-- 4. APPOINTMENT INVENTORY DEDUCTIONS (Duplicate Deduction Guard)
create table if not exists appointment_inventory_deductions (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references appointments(id) on delete cascade,
  service_id uuid not null references services(id) on delete restrict,
  staff_id uuid references staff(id) on delete set null,
  deducted_at timestamptz not null default now()
);

-- Indexes for audit lookups & performance
create index if not exists idx_inventory_movements_item on inventory_movements(inventory_item_id);
create index if not exists idx_inventory_movements_appt on inventory_movements(appointment_id);
create index if not exists idx_inventory_movements_staff on inventory_movements(staff_id);
create index if not exists idx_service_recipes_service on service_inventory_recipes(service_id);

-- 5. ATOMIC STORED FUNCTION FOR TRANSACTIONAL DEDUCTION
create or replace function deduct_inventory_for_appointment(
  p_appointment_id uuid,
  p_user_id text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_service_id uuid;
  v_staff_id uuid;
  v_appt_status text;
  v_recipe record;
  v_current_stock numeric;
  v_item_name text;
begin
  -- 1. Check if appointment already has recorded inventory deduction (idempotency guard)
  if exists (select 1 from appointment_inventory_deductions where appointment_id = p_appointment_id) then
    return jsonb_build_object('success', true, 'message', 'Inventory already deducted for this appointment.', 'deducted', false);
  end if;

  -- 2. Fetch appointment details
  select service_id, staff_id, status into v_service_id, v_staff_id, v_appt_status
  from appointments
  where id = p_appointment_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Appointment not found.');
  end if;

  -- 3. Check all required recipe items for sufficient stock with row locking (FOR UPDATE)
  for v_recipe in
    select r.inventory_item_id, r.quantity, i.name, i.current_stock
    from service_inventory_recipes r
    join inventory_items i on i.id = r.inventory_item_id
    where r.service_id = v_service_id
    for update of i
  loop
    if v_recipe.current_stock < v_recipe.quantity then
      return jsonb_build_object(
        'success', false,
        'error', format('Insufficient stock for %s. Required: %s, Available: %s', v_recipe.name, v_recipe.quantity, v_recipe.current_stock)
      );
    end if;
  end loop;

  -- 4. Deduct stock and log movements
  for v_recipe in
    select r.inventory_item_id, r.quantity, i.current_stock
    from service_inventory_recipes r
    join inventory_items i on i.id = r.inventory_item_id
    where r.service_id = v_service_id
  loop
    update inventory_items
    set current_stock = current_stock - v_recipe.quantity,
        updated_at = now()
    where id = v_recipe.inventory_item_id;

    insert into inventory_movements (
      inventory_item_id,
      change_quantity,
      previous_stock,
      new_stock,
      movement_type,
      reason,
      appointment_id,
      service_id,
      staff_id,
      created_by_user_id
    ) values (
      v_recipe.inventory_item_id,
      -v_recipe.quantity,
      v_recipe.current_stock,
      v_recipe.current_stock - v_recipe.quantity,
      'service_consumption',
      'Appointment completion usage',
      p_appointment_id,
      v_service_id,
      v_staff_id,
      p_user_id
    );
  end loop;

  -- 5. Record deduction marker
  insert into appointment_inventory_deductions (
    appointment_id,
    service_id,
    staff_id
  ) values (
    p_appointment_id,
    v_service_id,
    v_staff_id
  );

  return jsonb_build_object('success', true, 'message', 'Inventory deducted successfully.', 'deducted', true);
end;
$$;
