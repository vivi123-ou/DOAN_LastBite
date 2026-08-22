-- Adopts the advisor-reviewed pricing table: Basic 149k/tháng (was 99k),
-- Premium 349k/tháng (was 299k). Only Basic gets a yearly billing option
-- (1.290k/năm) — deliberately not Premium. Modeled directly on how Claude's
-- own real pricing works (Claude Pro has an annual option, Claude Max does
-- not, month-to-month only): a discount to lock in commitment makes sense
-- on the higher-volume mid tier, less so on the top tier where customers
-- are already less price-sensitive and the platform would rather keep full
-- margin/flexibility than discount a smaller pool of premium customers.
-- (An earlier draft of this migration also added "Premium (năm)" at
-- 2.990k/năm — removed per this same Claude-pricing-model comparison,
-- discussed directly with the user before finalizing.)
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
values (
  'Basic (năm)', 1290000, 365, 20, 'basic',
  'Giống hệt gói Basic, thanh toán theo năm — tiết kiệm hơn so với trả theo tháng.',
  false, true
);
