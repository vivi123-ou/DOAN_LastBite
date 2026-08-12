-- Additive migration (see .claude/rules/database-and-schema.md — 0001-0007
-- are never edited). New RPC for the homepage search bar + price filter —
-- nearby_combos() (0001) is left untouched rather than overloaded: its
-- `order by s.geog <-> point` is what lets Postgres use the GiST index for
-- KNN-ordered results, and that index-assisted ordering only applies to a
-- bare `<->` expression, not one wrapped in a sort-mode CASE. Search/price-
-- sort needs a different ORDER BY shape, hence a separate function per the
-- "add a new SQL function if you need a new geo query shape" rule.

create function search_combos(
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
  image_url text
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
    ci.url
  from combos c
  join stores s on s.id = c.store_id
  left join lateral (
    select url from combo_images
    where combo_id = c.id
    order by sort_order
    limit 1
  ) ci on true
  where c.status = 'active'
    and s.is_active
    and s.verification_status = 'verified'
    and (in_category_id is null or c.category_id = in_category_id)
    and (min_price is null or c.current_price >= min_price)
    and (max_price is null or c.current_price <= max_price)
    and (
      in_query is null or in_query = ''
      -- Same expression idx_combos_name_trgm / idx_stores_name_trgm (0001)
      -- are built on, so this ILIKE is index-backed, not a full scan.
      or lower(f_unaccent(c.name)) ilike '%' || lower(f_unaccent(in_query)) || '%'
      or lower(f_unaccent(s.name)) ilike '%' || lower(f_unaccent(in_query)) || '%'
    )
    and st_dwithin(s.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography, radius_m)
  order by
    case when sort_by = 'price_asc' then c.current_price end asc,
    case when sort_by = 'price_desc' then c.current_price end desc,
    st_distance(s.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography) asc
  limit max_results;
$$;
