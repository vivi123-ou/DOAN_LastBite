-- Additive migration (0001-0010 applied and never edited). Fixes a real gap
-- against the mandatory business rule in .claude/rules/business-rules.md:
-- "A combo automatically becomes unavailable for purchase the instant
-- now() > best_before. This check must happen both in the DB query...
-- and defensively before finalizing any order." The order-finalization
-- half was already implemented (order.builder.ts already re-checks
-- best_before against a fresh snapshot at checkout) — the *listing* half
-- was not: nearby_combos() and search_combos() only ever filtered on
-- `status = 'active'`, and nothing in this codebase flips status to
-- 'locked' on a schedule (no cron/sweep infrastructure exists yet — see
-- CLAUDE.md §7), so an expired-but-still-'active' combo kept showing up
-- on the homepage indefinitely.
--
-- Fix: both functions now also filter `best_before > now()`. This is
-- exactly what idx_combos_active_best_before (0001: `combos (best_before)
-- where status = 'active'`) was already built for — it was sitting unused
-- until this query actually needed it.
--
-- Return type is unchanged for both, so CREATE OR REPLACE is valid here
-- (unlike 0006/0009, which had to drop first because they added columns).

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
  distance_m float8,
  image_url text,
  delivery_supported boolean,
  pickup_supported boolean
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
    st_distance(s.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography),
    ci.url,
    c.delivery_supported,
    c.pickup_supported
  from combos c
  join stores s on s.id = c.store_id
  left join lateral (
    select url from combo_images
    where combo_id = c.id
    order by sort_order
    limit 1
  ) ci on true
  where c.status = 'active'
    and c.best_before > now()
    and s.is_active
    and s.verification_status = 'verified'
    and (in_category_id is null or c.category_id = in_category_id)
    and st_dwithin(s.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography, radius_m)
  order by s.geog <-> st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography
  limit max_results;
$$;

create or replace function search_combos(
  in_lat float8,
  in_lng float8,
  in_query text default null,
  radius_m int default 5000,
  max_results int default 30,
  in_category_id uuid default null,
  min_price numeric default null,
  max_price numeric default null,
  sort_by text default 'relevance'
) returns table (
  combo_id uuid,
  name text,
  current_price numeric,
  original_price numeric,
  best_before timestamptz,
  store_id uuid,
  store_name text,
  distance_m float8,
  image_url text,
  delivery_supported boolean,
  pickup_supported boolean
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
    st_distance(s.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography),
    ci.url,
    c.delivery_supported,
    c.pickup_supported
  from combos c
  join stores s on s.id = c.store_id
  left join lateral (
    select url from combo_images
    where combo_id = c.id
    order by sort_order
    limit 1
  ) ci on true
  where c.status = 'active'
    and c.best_before > now()
    and s.is_active
    and s.verification_status = 'verified'
    and (in_category_id is null or c.category_id = in_category_id)
    and (min_price is null or c.current_price >= min_price)
    and (max_price is null or c.current_price <= max_price)
    and (
      in_query is null or in_query = ''
      or lower(f_unaccent(c.name)) ilike '%' || lower(f_unaccent(in_query)) || '%'
      or lower(f_unaccent(s.name)) ilike '%' || lower(f_unaccent(in_query)) || '%'
    )
    and st_dwithin(s.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography, radius_m)
  order by
    case when sort_by = 'price_asc' then c.current_price end asc,
    case when sort_by = 'price_desc' then c.current_price end desc,
    case when sort_by = 'newest' then c.created_at end desc,
    st_distance(s.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography) asc
  limit max_results;
$$;
