-- Real bug, caught live: the "Ưu đãi nổi bật" sponsored row/badge only ever
-- showed up for the sponsoring store owner's own account, never for any
-- other customer viewing the same public homepage/search results.
--
-- Root cause: nearby_combos()/search_combos() (0035) compute `is_sponsored`
-- via `exists (select 1 from ad_bookings ab ...)`. ad_bookings' only select
-- policy (ad_bookings_select_own, 0035) scopes rows to
-- `exists (select 1 from stores s where s.id = ad_bookings.store_id and
-- s.owner_id = auth.uid())` — the owning store's own session only. Neither
-- function was ever marked `security definer`, so that inner EXISTS
-- subquery executed under the *calling* session's own RLS context: for any
-- customer who isn't that store's owner, the subquery legitimately (and
-- correctly, per the policy) returns no rows, so `is_sponsored` silently
-- came back false for everyone except the store owner testing their own
-- purchased placement.
--
-- Fix: mark both functions `security definer` (same established pattern as
-- handle_new_user() in 0001, and the ad-banners storage-owner-check fix in
-- 0004/0037) so the ad_bookings subquery runs with full visibility — safe
-- here because the only thing either function ever returns from that
-- subquery is a computed boolean (`is_sponsored`); no ad_bookings column
-- (amount_paid, payment_method, provider_txn_id, etc.) is ever exposed in
-- either function's result. Everything else both functions already touch
-- (combos/stores) is already publicly readable once verified/active, so
-- nothing new leaks by running the rest of the function definer-side
-- either.
--
-- CREATE OR REPLACE is valid here (unlike 0035's own DROP FUNCTION): the
-- argument list and return table shape are both completely unchanged, only
-- the function's security/body attribute is being added.

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
  pickup_supported boolean,
  is_sponsored boolean
)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    c.name,
    dynamic_combo_price(
      c.original_price, c.initial_stock, c.remaining_stock, c.created_at, c.best_before,
      max_discount_pct => c.max_discount_pct
    ),
    c.original_price,
    c.best_before,
    s.id,
    s.name,
    st_distance(s.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography),
    ci.url,
    c.delivery_supported,
    c.pickup_supported,
    exists (
      select 1 from ad_bookings ab
      join ad_placement_types apt on apt.id = ab.placement_type_id
      where ab.combo_id = c.id
        and ab.status = 'active'
        and ab.starts_at <= now()
        and ab.ends_at > now()
        and apt.key in ('hot_deal', 'search_top', 'category_top')
    ) as is_sponsored
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
  order by is_sponsored desc, s.geog <-> st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography
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
  pickup_supported boolean,
  is_sponsored boolean
)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    c.name,
    dynamic_combo_price(
      c.original_price, c.initial_stock, c.remaining_stock, c.created_at, c.best_before,
      max_discount_pct => c.max_discount_pct
    ),
    c.original_price,
    c.best_before,
    s.id,
    s.name,
    st_distance(s.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography),
    ci.url,
    c.delivery_supported,
    c.pickup_supported,
    exists (
      select 1 from ad_bookings ab
      join ad_placement_types apt on apt.id = ab.placement_type_id
      where ab.combo_id = c.id
        and ab.status = 'active'
        and ab.starts_at <= now()
        and ab.ends_at > now()
        and apt.key in ('hot_deal', 'search_top', 'category_top')
    ) as is_sponsored
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
    and (
      min_price is null
      or dynamic_combo_price(
           c.original_price, c.initial_stock, c.remaining_stock, c.created_at, c.best_before,
           max_discount_pct => c.max_discount_pct
         ) >= min_price
    )
    and (
      max_price is null
      or dynamic_combo_price(
           c.original_price, c.initial_stock, c.remaining_stock, c.created_at, c.best_before,
           max_discount_pct => c.max_discount_pct
         ) <= max_price
    )
    and (
      in_query is null or in_query = ''
      or lower(f_unaccent(c.name)) ilike '%' || lower(f_unaccent(in_query)) || '%'
      or lower(f_unaccent(s.name)) ilike '%' || lower(f_unaccent(in_query)) || '%'
    )
    and st_dwithin(s.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography, radius_m)
  order by
    is_sponsored desc,
    case when sort_by = 'price_asc' then
      dynamic_combo_price(
        c.original_price, c.initial_stock, c.remaining_stock, c.created_at, c.best_before,
        max_discount_pct => c.max_discount_pct
      )
    end asc,
    case when sort_by = 'price_desc' then
      dynamic_combo_price(
        c.original_price, c.initial_stock, c.remaining_stock, c.created_at, c.best_before,
        max_discount_pct => c.max_discount_pct
      )
    end desc,
    case when sort_by = 'newest' then c.created_at end desc,
    st_distance(s.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography) asc
  limit max_results;
$$;
