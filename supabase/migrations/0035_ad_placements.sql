-- Admin module 3/3 (Quảng cáo & Vị trí Hiển thị) — the last of the three
-- modules explicitly sequenced by the user (Gói dịch vụ → Hoa hồng →
-- Quảng cáo), confirmed as its own separate mua-thêm product, not bundled
-- into subscription tiers (see CLAUDE.md's "Advertising features" entry).
--
-- One `ad_placement_types` + `ad_bookings` pair, mirroring the exact shape
-- already proven for subscriptions (0027's subscription_plans/
-- store_subscriptions) — same reasoning: admin configures what's for sale
-- and its price/duration, a store buys a specific instance of it. Every
-- write (creating a pending purchase, activating on payment, admin
-- oversight) follows the same `payments` pattern the rest of this app's
-- money-handling tables already use: zero client-facing write policy,
-- service-role only.
--
-- Five ad products from the reference table collapse into three real
-- mechanisms, not five separate implementations — see the entries in
-- CLAUDE.md's "Module 3/3" round for the full reasoning:
--   - 'hot_deal' / 'search_top' / 'category_top': all three just mean
--     "show this combo first" within whatever search the customer already
--     ran (radius/category filters are already applied by nearby_combos()/
--     search_combos() themselves) — one underlying boost mechanism serving
--     three differently-named, differently-priced products.
--   - 'homepage_banner': a real slot on the homepage, own image/link.
--   - 'diamond_partner': a store-level (not combo-level) badge, with
--     manual admin oversight for "exclusive in this area" claims (this app
--     has no real geo-exclusivity enforcement — an admin sees overlapping
--     active bookings and resolves it manually, same posture as any other
--     judgment call this admin panel already leaves to a human rather than
--     over-automating).
-- The Fanpage-post bullet from the original reference table is explicitly
-- NOT built — posting to a real Facebook Page needs Meta's own Graph API
-- and a connected Page access token, a real third-party integration this
-- app has never touched (same class of gap as VietQR/PayOS/Casso, flagged
-- honestly rather than faked).

create table ad_placement_types (
  id uuid primary key default gen_random_uuid(),
  -- 'hot_deal' | 'search_top' | 'category_top' | 'homepage_banner' | 'diamond_partner'
  key text not null,
  name text not null,
  description text,
  price numeric not null check (price >= 0),
  duration_days int not null check (duration_days > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table ad_bookings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores (id) on delete cascade,
  placement_type_id uuid not null references ad_placement_types (id),
  -- Required for hot_deal/search_top/category_top (boosting one specific
  -- combo); null for homepage_banner/diamond_partner (store-level, no
  -- single combo to boost).
  combo_id uuid references combos (id) on delete cascade,
  -- Record of what the store believed they were buying ("khu vực 3-5km") —
  -- not actually used to gate visibility (see the note above: a boosted
  -- combo only ever shows within whatever radius the customer's own search
  -- already covers), kept for honest display on the booking's own summary.
  radius_m int,
  banner_image_url text,
  link_url text,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'active', 'expired', 'cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  amount_paid numeric,
  payment_method text check (payment_method in ('vnpay', 'momo')),
  provider_txn_id text,
  impression_count int not null default 0,
  click_count int not null default 0,
  -- Admin's own notes, e.g. resolving a diamond_partner exclusivity
  -- conflict manually — same spirit as combo_reviews.admin_note.
  admin_note text,
  created_at timestamptz not null default now()
);

create index idx_ad_bookings_store on ad_bookings (store_id, created_at desc);
create index idx_ad_bookings_combo_active on ad_bookings (combo_id) where status = 'active';

alter table ad_placement_types enable row level security;

-- Public-ish read (any signed-in store owner browsing what's for sale),
-- scoped to still-offered types — same posture as subscription_plans_select_active.
create policy ad_placement_types_select_active on ad_placement_types
  for select using (is_active);

-- No client-facing insert/update — admin-only, always through the
-- service-role client (admin.repository.ts).

alter table ad_bookings enable row level security;

-- A store owner can see their own bookings — same ownership-join style as
-- every other store-scoped table in this schema.
create policy ad_bookings_select_own on ad_bookings
  for select using (
    exists (select 1 from stores s where s.id = ad_bookings.store_id and s.owner_id = auth.uid())
  );

-- No insert/update policy at all, on purpose — this table handles money
-- and its status transitions are only ever valid once a gateway's IPN
-- confirms them (or an admin acts), so it follows the exact `payments`
-- pattern (.claude/rules/database-and-schema.md).

-- Storage bucket for homepage banner images — objects at `${storeId}/...`,
-- same ownership-join-by-path-prefix shape as combo-images (0003), not
-- avatars' direct auth.uid() match, since a banner belongs to a store, not
-- directly to the uploading user.
insert into storage.buckets (id, name, public)
values ('ad-banners', 'ad-banners', true)
on conflict (id) do nothing;

create policy ad_banners_bucket_public_read on storage.objects
  for select using (bucket_id = 'ad-banners');

create policy ad_banners_bucket_owner_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ad-banners'
    and exists (
      select 1 from stores s
      where s.id = (storage.foldername(name))[1]::uuid
        and s.owner_id = auth.uid()
    )
  );

create policy ad_banners_bucket_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'ad-banners'
    and exists (
      select 1 from stores s
      where s.id = (storage.foldername(name))[1]::uuid
        and s.owner_id = auth.uid()
    )
  );

insert into ad_placement_types (key, name, description, price, duration_days) values
  ('hot_deal', 'Nhãn HOT DEAL', 'Gắn nhãn nổi bật trên thẻ combo trong 1 ngày.', 19000, 1),
  ('search_top', 'Top tìm kiếm khu vực (7 ngày)', 'Combo hiển thị đầu danh sách khi khách tìm/xem gần bạn, trong bán kính khách đang tìm.', 249000, 7),
  ('category_top', 'Top ngành hàng (7 ngày)', 'Combo hiển thị đầu danh sách khi khách lọc theo đúng loại combo này.', 199000, 7),
  ('homepage_banner', 'Banner trang chủ (7 ngày)', 'Banner cửa hàng hiển thị trong khu vực nổi bật trên trang chủ.', 499000, 7),
  ('diamond_partner', 'Đối tác Kim Cương (1 năm)', 'Huy hiệu đối tác nổi bật nhất, xét duyệt thủ công bởi quản trị viên.', 2490000, 365);

-- Return shape unchanged for dynamic_combo_price() itself — only
-- nearby_combos()/search_combos() below gain a new returned column
-- (is_sponsored), which needs DROP FUNCTION first (same rule already
-- followed in 0006/0009 for the same reason: CREATE OR REPLACE can't
-- change a function's return columns).
drop function if exists nearby_combos(float8, float8, int, int, uuid);
drop function if exists search_combos(float8, float8, text, int, int, uuid, numeric, numeric, text);

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
  pickup_supported boolean,
  is_sponsored boolean
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
    c.pickup_supported,
    exists (
      select 1 from ad_bookings ab
      join ad_placement_types apt on apt.id = ab.placement_type_id
      where ab.combo_id = c.id
        and ab.status = 'active'
        and ab.starts_at <= now()
        and ab.ends_at > now()
        and apt.key in ('hot_deal', 'search_top', 'category_top')
    )
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
  image_url text,
  delivery_supported boolean,
  pickup_supported boolean,
  is_sponsored boolean
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
    c.pickup_supported,
    exists (
      select 1 from ad_bookings ab
      join ad_placement_types apt on apt.id = ab.placement_type_id
      where ab.combo_id = c.id
        and ab.status = 'active'
        and ab.starts_at <= now()
        and ab.ends_at > now()
        and apt.key in ('hot_deal', 'search_top', 'category_top')
    )
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
    -- Paid placement always shows first, regardless of the customer's own
    -- sort choice — same "advertiser pays for guaranteed prominence"
    -- behavior real marketplaces (Shopee/Amazon sponsored results) already
    -- use, not something invented for this app.
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
