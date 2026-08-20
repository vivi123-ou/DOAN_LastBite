-- Additive migration (0001-0015 applied and never edited). Phase 3 dynamic
-- pricing — .claude/rules/business-rules.md: combo price "must be
-- recomputed continuously from remaining stock and elapsed time... not
-- stepped down at fixed clock times."
--
-- No table/column changes needed: original_price, current_price,
-- initial_stock, remaining_stock, best_before, created_at all already exist
-- on combos (0001). This adds one pure helper function, dynamic_combo_price(),
-- and swaps `c.current_price` for a call to it inside nearby_combos() and
-- search_combos() — both functions' RETURNS TABLE shape is unchanged (still
-- a `current_price numeric` column, just now populated by a computed value
-- instead of a straight column read), so CREATE OR REPLACE is valid here,
-- no DROP needed (unlike 0006/0009, which changed the column list).
--
-- This formula must be kept in sync with computeStockBasedDecayPrice() in
-- lib/pricing/strategies/stock-based-decay.strategy.ts — that TS copy is
-- what combo.repository.ts uses for the full-Combo detail/dashboard read
-- path and the checkout-charging snapshot path; this SQL copy is what the
-- two index-backed PostGIS listing RPCs use, since they can't call into TS.
-- Duplicated on purpose (same accepted-tradeoff shape as the sequential
-- stock decrement documented in order.builder.ts), not a bug.
create or replace function dynamic_combo_price(
  original_price numeric,
  initial_stock int,
  remaining_stock int,
  created_at timestamptz,
  best_before timestamptz,
  as_of timestamptz default now()
) returns numeric
language sql stable as $$
  select round(
    original_price * (
      1 - 0.5 * (
        -- timeUrgency: how far through created_at→best_before `as_of`
        -- already is, clamped to [0,1].
        0.5 * least(1.0, greatest(0.0,
          case when best_before <= created_at then 1.0
          else extract(epoch from (as_of - created_at))
               / extract(epoch from (best_before - created_at))
          end
        ))
        -- stockPressure: how much of the original stock is still unsold,
        -- clamped to [0,1].
        + 0.5 * least(1.0, greatest(0.0,
          case when initial_stock <= 0 then 0.0
          else remaining_stock::numeric / initial_stock
          end
        ))
      )
    ) / 500
  ) * 500;
$$;

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
    dynamic_combo_price(c.original_price, c.initial_stock, c.remaining_stock, c.created_at, c.best_before),
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
    dynamic_combo_price(c.original_price, c.initial_stock, c.remaining_stock, c.created_at, c.best_before),
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
    and (
      min_price is null
      or dynamic_combo_price(c.original_price, c.initial_stock, c.remaining_stock, c.created_at, c.best_before) >= min_price
    )
    and (
      max_price is null
      or dynamic_combo_price(c.original_price, c.initial_stock, c.remaining_stock, c.created_at, c.best_before) <= max_price
    )
    and (
      in_query is null or in_query = ''
      or lower(f_unaccent(c.name)) ilike '%' || lower(f_unaccent(in_query)) || '%'
      or lower(f_unaccent(s.name)) ilike '%' || lower(f_unaccent(in_query)) || '%'
    )
    and st_dwithin(s.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography, radius_m)
  order by
    case when sort_by = 'price_asc' then
      dynamic_combo_price(c.original_price, c.initial_stock, c.remaining_stock, c.created_at, c.best_before)
    end asc,
    case when sort_by = 'price_desc' then
      dynamic_combo_price(c.original_price, c.initial_stock, c.remaining_stock, c.created_at, c.best_before)
    end desc,
    case when sort_by = 'newest' then c.created_at end desc,
    st_distance(s.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography) asc
  limit max_results;
$$;
