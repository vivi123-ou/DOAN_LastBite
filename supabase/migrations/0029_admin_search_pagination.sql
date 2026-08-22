-- Admin scaling round: real server-side pagination + index-backed search for
-- the three admin lists that can realistically grow large (stores, combos,
-- users) — replaces the old "fetch up to 200 rows, filter with plain ilike"
-- approach. `idx_stores_name_trgm`/`idx_combos_name_trgm` (0001) and
-- `idx_profiles_full_name_trgm` (0010) already exist for exactly this
-- access pattern but were never actually used by the admin panel's search —
-- these RPCs use the same `lower(f_unaccent(...)) ilike` expression shape
-- those indexes are built on, so Postgres can actually use them, per
-- .claude/rules/database-and-schema.md's indexing rule.
--
-- Each returns `total_count` (a `count(*) over()` window column) alongside
-- the page of rows, so the app can render real "Trang X/Y" pagination
-- instead of a silent hard cap. `limit_n`/`offset_n` implement the paging
-- itself. Reports/subscriptions/payouts are deliberately NOT converted to
-- this RPC style — those three lists are already built by joining data in
-- JS after the initial fetch (store/customer/plan names), and this
-- capstone's data model means they stay much smaller than combos/users in
-- practice (one row per filed complaint / per billing period), so
-- JS-side pagination over the already-fetched, already-filtered array is an
-- acceptable tradeoff there — see admin.repository.ts / commission.repository.ts /
-- subscription.repository.ts's own comments for the per-list reasoning.

create or replace function admin_search_stores(
  search_text text default null,
  status_filter text default null,
  limit_n int default 20,
  offset_n int default 0
) returns table (
  id uuid,
  name text,
  address_line text,
  verification_status text,
  is_active boolean,
  created_at timestamptz,
  owner_id uuid,
  owner_name text,
  total_count bigint
)
language sql stable as $$
  select
    s.id, s.name, s.address_line, s.verification_status, s.is_active, s.created_at, s.owner_id,
    p.full_name as owner_name,
    count(*) over() as total_count
  from stores s
  left join profiles p on p.id = s.owner_id
  where
    (search_text is null or search_text = '' or
      lower(f_unaccent(s.name)) ilike '%' || lower(f_unaccent(search_text)) || '%')
    and (status_filter is null or status_filter = '' or s.verification_status = status_filter)
  order by s.created_at desc
  limit limit_n offset offset_n;
$$;

-- `store_id_filter` lets the same function back both the main /admin/combos
-- list and a single store's detail page (app/(admin)/admin/stores/[id]) —
-- one query shape, not two near-duplicate ones. Reuses `dynamic_combo_price()`
-- (0017/0025) for the live price, same as nearby_combos()/search_combos() —
-- the customer-facing listing queries — rather than re-fetching raw columns
-- and computing price in JS the way the old listCombosForAdmin() did.
create or replace function admin_search_combos(
  search_text text default null,
  status_filter text default null,
  store_id_filter uuid default null,
  limit_n int default 20,
  offset_n int default 0
) returns table (
  id uuid,
  name text,
  original_price numeric,
  current_price numeric,
  initial_stock int,
  remaining_stock int,
  created_at timestamptz,
  best_before timestamptz,
  status text,
  store_id uuid,
  store_name text,
  total_count bigint
)
language sql stable as $$
  select
    c.id, c.name, c.original_price,
    dynamic_combo_price(
      c.original_price, c.initial_stock, c.remaining_stock, c.created_at, c.best_before,
      now(), c.max_discount_pct
    ) as current_price,
    c.initial_stock, c.remaining_stock, c.created_at, c.best_before, c.status, c.store_id,
    s.name as store_name,
    count(*) over() as total_count
  from combos c
  join stores s on s.id = c.store_id
  where
    (search_text is null or search_text = '' or
      lower(f_unaccent(c.name)) ilike '%' || lower(f_unaccent(search_text)) || '%')
    and (status_filter is null or status_filter = '' or c.status = status_filter)
    and (store_id_filter is null or c.store_id = store_id_filter)
  order by c.created_at desc
  limit limit_n offset offset_n;
$$;

-- order_count computed here via a grouped join, replacing the old
-- listUsersForAdmin()'s JS aggregation over *every* row of `orders` on
-- every single page load — a real scaling cost that only gets worse as
-- order volume grows, independent of how many users are being viewed.
create or replace function admin_search_users(
  search_text text default null,
  role_filter text default null,
  limit_n int default 20,
  offset_n int default 0
) returns table (
  id uuid,
  full_name text,
  role text,
  net_zero_points int,
  created_at timestamptz,
  order_count bigint,
  total_count bigint
)
language sql stable as $$
  select
    p.id, p.full_name, p.role, p.net_zero_points, p.created_at,
    coalesce(o.cnt, 0) as order_count,
    count(*) over() as total_count
  from profiles p
  left join (
    select customer_id, count(*) as cnt from orders group by customer_id
  ) o on o.customer_id = p.id
  where
    (search_text is null or search_text = '' or
      lower(f_unaccent(p.full_name)) ilike '%' || lower(f_unaccent(search_text)) || '%')
    and (role_filter is null or role_filter = '' or p.role = role_filter)
  order by p.created_at desc
  limit limit_n offset offset_n;
$$;
