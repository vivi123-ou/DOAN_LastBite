-- Additive migration (0001-0024 applied and never edited). Store-owner
-- control over dynamic pricing's discount ceiling — direct user request:
-- let each store choose how deep their combo's price is allowed to drop,
-- via a control on the combo form, instead of the fixed 50% every combo
-- used until now.
--
-- Deliberately NOT a per-hour manual discount schedule (an earlier version
-- of this request) — that would let customers predict the exact price at a
-- given clock time and "canh giờ" wait for it, directly violating the
-- mandatory business rule in .claude/rules/business-rules.md ("must be
-- recomputed continuously... never a fixed-time discount step... so
-- customers can't wait out the clock"). Instead, the store picks ONE number
-- once, at listing time — a ceiling — and the existing continuous
-- time×stock formula still decides the actual price at any given moment,
-- same as before. The store gets real control; the anti-gaming property is
-- preserved.
alter table combos
  add column max_discount_pct numeric not null default 50
    check (max_discount_pct >= 10 and max_discount_pct <= 70);

-- dynamic_combo_price() gains a max_discount_pct parameter (percentage,
-- 0-100), replacing the previously-hardcoded 0.5 multiplier — see the
-- matching change in lib/pricing/strategies/stock-based-decay.strategy.ts.
-- Positioned after as_of (both keep defaults) so existing positional callers
-- that only pass the first 5 args are unaffected; nearby_combos()/
-- search_combos() below are updated to pass it via named-argument syntax
-- (`max_discount_pct => c.max_discount_pct`) so they can skip as_of cleanly.
create or replace function dynamic_combo_price(
  original_price numeric,
  initial_stock int,
  remaining_stock int,
  created_at timestamptz,
  best_before timestamptz,
  as_of timestamptz default now(),
  max_discount_pct numeric default 50
) returns numeric
language sql stable as $$
  select round(
    original_price * (
      1 - (max_discount_pct / 100) * (
        -- timeUrgency: how far through created_at→best_before `as_of`
        -- already is, clamped to [0,1].
        least(1.0, greatest(0.0,
          case when best_before <= created_at then 1.0
          else extract(epoch from (as_of - created_at))
               / extract(epoch from (best_before - created_at))
          end
        ))
        -- multiplied (not added) by stockPressure: how much of the
        -- original stock is still unsold, clamped to [0,1].
        * least(1.0, greatest(0.0,
          case when initial_stock <= 0 then 0.0
          else remaining_stock::numeric / initial_stock
          end
        ))
      )
    ) / 500
  ) * 500;
$$;

-- Return shape unchanged — CREATE OR REPLACE valid here, no DROP needed.
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
