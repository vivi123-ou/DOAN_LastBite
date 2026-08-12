-- Additive migration (see .claude/rules/database-and-schema.md — 0001-0007
-- are applied and never edited; 0008 was edited in place because it hadn't
-- been applied yet, see its header comment). nearby_combos() (0006) HAS
-- been applied, so it gets a real new migration instead: adds
-- delivery_supported/pickup_supported to its return row so homepage listing
-- cards (all three tabs of app/(customer)/_components/combo-tabs-section.tsx
-- — "Gần bạn nhất" and "Gợi ý cho bạn" both source from this RPC) can render
-- a working "Thêm vào giỏ hàng" button without a second fetch per card.
--
-- Same reason as 0006's own comment: Postgres won't let CREATE OR REPLACE
-- change a function's return row shape, so drop + recreate.

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
    and s.is_active
    and s.verification_status = 'verified'
    and (in_category_id is null or c.category_id = in_category_id)
    and st_dwithin(s.geog, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography, radius_m)
  order by s.geog <-> st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography
  limit max_results;
$$;
