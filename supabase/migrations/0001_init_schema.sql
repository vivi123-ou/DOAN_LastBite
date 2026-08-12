-- LastBite — initial schema (all phases). See .claude/rules/database-and-schema.md.
-- This migration is additive-only from here forward: never edit this file after
-- it has been applied anywhere — create 0002_*, 0003_*, ... instead.

-- ============================================================================
-- Extensions
-- ============================================================================
create extension if not exists postgis;
create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- unaccent() is STABLE, not IMMUTABLE, so it can't be used directly in an index
-- expression. Wrap it in an IMMUTABLE function for indexing store/combo names.
create or replace function f_unaccent(text) returns text
language sql immutable parallel safe as $$
  select unaccent($1)
$$;

-- ============================================================================
-- Identity
-- ============================================================================
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'customer' check (role in ('customer', 'store_owner')),
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Populates profiles from auth.users on signup. Reads an optional "role" and
-- "full_name" from signup metadata (used by the email/password signup form);
-- Google OAuth signups have no such metadata and default to 'customer' — a
-- user becomes a store_owner for real when they submit the store
-- registration form (see store.repository.ts registerStore()).
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'customer'),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create table addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  label text,
  address_line text not null,
  geog geography(point, 4326) not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_addresses_user_id on addresses (user_id);
create index idx_addresses_geog on addresses using gist (geog);

-- ============================================================================
-- Categories (drives the combo category whitelist + default lock duration)
-- ============================================================================
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  default_lock_duration_minutes integer not null,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Stores
-- ============================================================================
create table stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  description text,
  address_line text not null,
  geog geography(point, 4326) not null,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected', 'suspended')),
  tier text not null default 'free' check (tier in ('free', 'premium')),
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_stores_owner_id on stores (owner_id);
create index idx_stores_geog on stores using gist (geog);
create index idx_stores_name_trgm on stores using gin (lower(f_unaccent(name)) gin_trgm_ops);

create table store_verification_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores (id) on delete cascade,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references profiles (id),
  reviewed_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  notes text
);

create index idx_store_verification_requests_store_id on store_verification_requests (store_id);

-- ============================================================================
-- Combos
-- ============================================================================
create table combos (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores (id) on delete cascade,
  category_id uuid not null references categories (id),
  name text not null,
  description text,
  original_price numeric(12, 0) not null check (original_price >= 0),
  current_price numeric(12, 0) not null check (current_price >= 0),
  initial_stock integer not null check (initial_stock >= 0),
  remaining_stock integer not null check (remaining_stock >= 0),
  best_before timestamptz not null,
  delivery_supported boolean not null default false,
  pickup_supported boolean not null default true,
  pricing_strategy text not null default 'stock_based_decay',
  status text not null default 'draft'
    check (status in ('draft', 'active', 'locked', 'sold_out', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_combos_store_id on combos (store_id);
create index idx_combos_category_id on combos (category_id);
-- Both the customer-facing listing query and the best-before auto-lock sweep
-- filter on exactly "status = 'active'", so the partial index covers both.
create index idx_combos_active_best_before on combos (best_before) where status = 'active';
create index idx_combos_name_trgm on combos using gin (lower(f_unaccent(name)) gin_trgm_ops);

create table combo_items (
  id uuid primary key default gen_random_uuid(),
  combo_id uuid not null references combos (id) on delete cascade,
  item_name text not null,
  item_description text,
  quantity integer not null default 1 check (quantity > 0)
);

create index idx_combo_items_combo_id on combo_items (combo_id);

create table combo_images (
  id uuid primary key default gen_random_uuid(),
  combo_id uuid not null references combos (id) on delete cascade,
  url text not null,
  sort_order integer not null default 0
);

create index idx_combo_images_combo_id on combo_images (combo_id);

create table price_history (
  id uuid primary key default gen_random_uuid(),
  combo_id uuid not null references combos (id) on delete cascade,
  price numeric(12, 0) not null,
  changed_at timestamptz not null default now()
);

create index idx_price_history_combo_id on price_history (combo_id, changed_at desc);

-- ============================================================================
-- Group-buy (phase 4 — table exists now, dormant until built)
-- ============================================================================
create table group_orders (
  id uuid primary key default gen_random_uuid(),
  initiator_id uuid not null references profiles (id),
  store_id uuid not null references stores (id),
  invite_code text not null unique,
  deadline timestamptz not null,
  status text not null default 'open' check (status in ('open', 'finalized', 'cancelled')),
  created_at timestamptz not null default now()
);

create index idx_group_orders_invite_code on group_orders (invite_code);

create table group_order_participants (
  id uuid primary key default gen_random_uuid(),
  group_order_id uuid not null references group_orders (id) on delete cascade,
  user_id uuid not null references profiles (id),
  joined_at timestamptz not null default now(),
  unique (group_order_id, user_id)
);

create index idx_group_order_participants_group_order_id on group_order_participants (group_order_id);

-- ============================================================================
-- Orders / payments (phase 2 — tables exist now, dormant until built)
-- ============================================================================
create table orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles (id),
  store_id uuid not null references stores (id),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'preparing', 'ready', 'completed', 'cancelled')),
  fulfillment_type text not null check (fulfillment_type in ('pickup', 'delivery')),
  delivery_address_id uuid references addresses (id),
  subtotal numeric(12, 0) not null default 0,
  discount_amount numeric(12, 0) not null default 0,
  bulk_discount_pct numeric(5, 2) not null default 0,
  total_amount numeric(12, 0) not null default 0,
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'success', 'failed', 'refunded')),
  payment_method text check (payment_method in ('vnpay', 'momo')),
  qr_code_token uuid unique,
  group_order_id uuid references group_orders (id),
  created_at timestamptz not null default now()
);

create index idx_orders_customer_id_created on orders (customer_id, created_at desc);
create index idx_orders_store_id_status on orders (store_id, status);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  combo_id uuid not null references combos (id),
  quantity integer not null check (quantity > 0),
  unit_price_at_purchase numeric(12, 0) not null,
  subtotal numeric(12, 0) not null
);

create index idx_order_items_order_id on order_items (order_id);

-- Money-handling table: no client RLS policies at all (see RLS section below).
-- Written only by server code (payment webhook/IPN handlers) using the
-- service-role client.
create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  provider text not null check (provider in ('vnpay', 'momo')),
  provider_txn_id text,
  amount numeric(12, 0) not null,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  raw_response jsonb,
  ipn_received_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_payments_order_id on payments (order_id);

create table bulk_discount_tiers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores (id) on delete cascade,
  min_quantity integer not null check (min_quantity > 1),
  discount_pct numeric(5, 2) not null check (discount_pct >= 0 and discount_pct <= 100)
);

create index idx_bulk_discount_tiers_store_id on bulk_discount_tiers (store_id);

-- ============================================================================
-- Notifications / search / recommendations (phase 3 — dormant until built)
-- ============================================================================
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  payload jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_user_unread on notifications (user_id, is_read, created_at desc);

create table search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  query_text text not null,
  searched_at timestamptz not null default now()
);

create index idx_search_history_user on search_history (user_id, searched_at desc);

create table user_category_affinity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  category_id uuid not null references categories (id),
  score numeric(6, 2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, category_id)
);

create index idx_user_category_affinity_user_id on user_category_affinity (user_id);

-- ============================================================================
-- Net Zero (phase 3 — dormant until built)
-- ============================================================================
create table co2_factors (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories (id),
  kg_co2_per_combo numeric(8, 3) not null
);

create table net_zero_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  order_id uuid not null references orders (id),
  co2_saved_kg numeric(8, 3) not null,
  computed_at timestamptz not null default now()
);

create index idx_net_zero_ledger_user_id on net_zero_ledger (user_id);

-- ============================================================================
-- Geo RPC — index-backed nearest-neighbor + radius search, no full table scan
-- ============================================================================
create or replace function nearby_combos(
  in_lat float8,
  in_lng float8,
  radius_m int default 5000,
  max_results int default 20,
  in_category_id uuid default null
) returns table (
  combo_id uuid,
  name text,
  current_price numeric,
  original_price numeric,
  best_before timestamptz,
  store_id uuid,
  store_name text,
  distance_m float8
)
language sql stable as $$
  select
    c.id,
    c.name,
    c.current_price,
    c.original_price,
    c.best_before,
    s.id,
    s.name,
    st_distance(s.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography)
  from combos c
  join stores s on s.id = c.store_id
  where c.status = 'active'
    and s.is_active
    and s.verification_status = 'verified'
    and (in_category_id is null or c.category_id = in_category_id)
    and st_dwithin(s.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography, radius_m)
  order by s.geog <-> st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography
  limit max_results;
$$;

-- ============================================================================
-- Row Level Security — enabled on every table, no exceptions.
-- ============================================================================

-- profiles: users manage their own row only.
alter table profiles enable row level security;
create policy profiles_select_own on profiles for select using (id = auth.uid());
create policy profiles_update_own on profiles for update using (id = auth.uid());

-- addresses: owner only.
alter table addresses enable row level security;
create policy addresses_all_own on addresses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- categories: public read, no client writes (managed via seed / service role).
alter table categories enable row level security;
create policy categories_select_all on categories for select using (true);

-- stores: public can see verified+active stores; owners see/manage their own
-- regardless of verification status.
alter table stores enable row level security;
create policy stores_select_public on stores for select
  using (verification_status = 'verified' and is_active);
create policy stores_select_own on stores for select using (owner_id = auth.uid());
create policy stores_insert_own on stores for insert with check (owner_id = auth.uid());
create policy stores_update_own on stores for update using (owner_id = auth.uid());

-- store_verification_requests: owner can see/create their own; approving them
-- (status -> approved/rejected) is done via service role only, no update policy.
alter table store_verification_requests enable row level security;
create policy svr_select_own on store_verification_requests for select
  using (exists (select 1 from stores s where s.id = store_verification_requests.store_id and s.owner_id = auth.uid()));
create policy svr_insert_own on store_verification_requests for insert
  with check (exists (select 1 from stores s where s.id = store_verification_requests.store_id and s.owner_id = auth.uid()));

-- combos: public sees active combos from verified stores; owner sees/manages
-- all their own combos regardless of status.
alter table combos enable row level security;
create policy combos_select_public on combos for select
  using (
    status = 'active'
    and exists (select 1 from stores s where s.id = combos.store_id and s.verification_status = 'verified' and s.is_active)
  );
create policy combos_select_own on combos for select
  using (exists (select 1 from stores s where s.id = combos.store_id and s.owner_id = auth.uid()));
create policy combos_all_own on combos for all
  using (exists (select 1 from stores s where s.id = combos.store_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from stores s where s.id = combos.store_id and s.owner_id = auth.uid()));

-- combo_items / combo_images: same visibility as their parent combo, via join.
alter table combo_items enable row level security;
create policy combo_items_select_public on combo_items for select
  using (exists (
    select 1 from combos c join stores s on s.id = c.store_id
    where c.id = combo_items.combo_id and c.status = 'active' and s.verification_status = 'verified' and s.is_active
  ));
create policy combo_items_all_own on combo_items for all
  using (exists (
    select 1 from combos c join stores s on s.id = c.store_id
    where c.id = combo_items.combo_id and s.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from combos c join stores s on s.id = c.store_id
    where c.id = combo_items.combo_id and s.owner_id = auth.uid()
  ));

alter table combo_images enable row level security;
create policy combo_images_select_public on combo_images for select
  using (exists (
    select 1 from combos c join stores s on s.id = c.store_id
    where c.id = combo_images.combo_id and c.status = 'active' and s.verification_status = 'verified' and s.is_active
  ));
create policy combo_images_all_own on combo_images for all
  using (exists (
    select 1 from combos c join stores s on s.id = c.store_id
    where c.id = combo_images.combo_id and s.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from combos c join stores s on s.id = c.store_id
    where c.id = combo_images.combo_id and s.owner_id = auth.uid()
  ));

-- price_history: store owner can read their own combos' history; writes are
-- server-side (dynamic pricing job), no client insert policy.
alter table price_history enable row level security;
create policy price_history_select_own on price_history for select
  using (exists (
    select 1 from combos c join stores s on s.id = c.store_id
    where c.id = price_history.combo_id and s.owner_id = auth.uid()
  ));

-- group_orders / participants: initiator has full access; participants can
-- read groups they've joined. Joining-by-invite-code is done via a server
-- route (service role), not a raw client insert policy, to avoid leaking
-- enumeration of other users' group orders.
alter table group_orders enable row level security;
create policy group_orders_all_initiator on group_orders for all
  using (initiator_id = auth.uid()) with check (initiator_id = auth.uid());
create policy group_orders_select_participant on group_orders for select
  using (exists (
    select 1 from group_order_participants p where p.group_order_id = group_orders.id and p.user_id = auth.uid()
  ));

alter table group_order_participants enable row level security;
create policy gop_select_own on group_order_participants for select using (user_id = auth.uid());

-- orders: customer sees/creates their own; store owner sees/updates orders
-- placed at their store (to accept/reject).
alter table orders enable row level security;
create policy orders_select_customer on orders for select using (customer_id = auth.uid());
create policy orders_insert_customer on orders for insert with check (customer_id = auth.uid());
create policy orders_select_store_owner on orders for select
  using (exists (select 1 from stores s where s.id = orders.store_id and s.owner_id = auth.uid()));
create policy orders_update_store_owner on orders for update
  using (exists (select 1 from stores s where s.id = orders.store_id and s.owner_id = auth.uid()));

alter table order_items enable row level security;
create policy order_items_select_customer on order_items for select
  using (exists (select 1 from orders o where o.id = order_items.order_id and o.customer_id = auth.uid()));
create policy order_items_select_store_owner on order_items for select
  using (exists (
    select 1 from orders o join stores s on s.id = o.store_id
    where o.id = order_items.order_id and s.owner_id = auth.uid()
  ));

-- payments: zero client-facing policies. RLS is enabled with no permissive
-- policy, so only the service-role key (server-side webhook/IPN handlers)
-- can read or write this table.
alter table payments enable row level security;

alter table bulk_discount_tiers enable row level security;
create policy bulk_discount_tiers_select_all on bulk_discount_tiers for select using (true);
create policy bulk_discount_tiers_all_owner on bulk_discount_tiers for all
  using (store_id is null or exists (select 1 from stores s where s.id = bulk_discount_tiers.store_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from stores s where s.id = bulk_discount_tiers.store_id and s.owner_id = auth.uid()));

-- notifications / search_history / net_zero_ledger: users read their own rows
-- only. Notifications and the Net Zero ledger are written by server/trigger
-- code, not directly by clients.
alter table notifications enable row level security;
create policy notifications_select_own on notifications for select using (user_id = auth.uid());
create policy notifications_update_own on notifications for update using (user_id = auth.uid());

alter table search_history enable row level security;
create policy search_history_select_own on search_history for select using (user_id = auth.uid());
create policy search_history_insert_own on search_history for insert with check (user_id = auth.uid());

alter table user_category_affinity enable row level security;
create policy user_category_affinity_select_own on user_category_affinity for select using (user_id = auth.uid());

alter table co2_factors enable row level security;
create policy co2_factors_select_all on co2_factors for select using (true);

alter table net_zero_ledger enable row level security;
create policy net_zero_ledger_select_own on net_zero_ledger for select using (user_id = auth.uid());
