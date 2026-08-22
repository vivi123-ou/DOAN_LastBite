-- Adopts the advisor-reviewed pricing table: Basic 149k/tháng (was 99k),
-- Premium 349k/tháng (was 299k), plus a yearly billing option for each
-- (Basic 1.290k/năm, Premium 2.990k/năm — confirmed with the user; the
-- "299k/năm" first floated for Premium didn't come close to covering this
-- app's real infra cost, see the reasoning given directly to the user).
--
-- A new `tier` column, not just relying on the `name` string, because a
-- plan's *tier* (what features it unlocks) and its *display name/billing
-- period* are now two different things once monthly and yearly variants of
-- the same tier both exist — feature gates (Net Zero store report, restock
-- suggestions, peak-hours stat) check `tier`, never `name`.
alter table subscription_plans add column tier text not null default 'free'
  check (tier in ('free', 'basic', 'premium'));

update subscription_plans set tier = 'free' where name = 'Free';

update subscription_plans set
  tier = 'basic',
  price = 149000,
  description = 'Tối đa 20 combo đang bán cùng lúc · Thống kê khung giờ bán chạy nhất · Gia hạn mỗi 30 ngày.'
where name = 'Basic';

update subscription_plans set
  tier = 'premium',
  price = 349000,
  description = 'Không giới hạn combo · Báo cáo tác động Net Zero của cửa hàng · Gợi ý số lượng nhập hàng thông minh · Huy hiệu Đối tác Premium · Gia hạn mỗi 30 ngày.'
where name = 'Premium';

insert into subscription_plans
  (name, price, duration_days, max_active_combos, tier, description, is_default, is_active)
values
  (
    'Basic (năm)', 1290000, 365, 20, 'basic',
    'Giống hệt gói Basic, thanh toán theo năm — tiết kiệm hơn so với trả theo tháng.',
    false, true
  ),
  (
    'Premium (năm)', 2990000, 365, null, 'premium',
    'Giống hệt gói Premium, thanh toán theo năm — tiết kiệm hơn so với trả theo tháng.',
    false, true
  );
