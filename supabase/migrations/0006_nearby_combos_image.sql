-- Additive migration (see .claude/rules/database-and-schema.md — 0001-0005
-- are never edited). Redefines nearby_combos() to also return each combo's
-- first image, so listing cards can show a real photo instead of a
-- text-only card.
--
-- Postgres won't let CREATE OR REPLACE change a function's return row type
-- (adding image_url here counts as that) — has to be dropped and recreated
-- instead. Fine to drop: it's a pure function, no data lives in it.

drop function if exists nearby_combos(float8, float8, int, int, uuid);

create function nearby_combos(
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
    and st_dwithin(s.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography, radius_m)
  order by s.geog <-> st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography
  limit max_results;
$$;
