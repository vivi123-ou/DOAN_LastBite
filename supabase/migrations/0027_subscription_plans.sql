-- Additive migration (0001-0026 applied and never edited). First of 3
-- admin modules explicitly sequenced by the user (Gói dịch vụ → Hoa hồng →
-- Quảng cáo) after an AskUserQuestion — this one: store subscription plans
-- + fee collection, using the already-real MoMo/VNPay gateways (never
-- VietQR/PayOS/Casso, which this app has never integrated — see CLAUDE.md).
--
-- stores.tier ('free'/'premium', 0001) has existed dormant since phase 1
-- with nothing ever reading or writing it (confirmed by grep before writing
-- this). Rather than leave it dormant alongside a brand-new parallel
-- concept, markSubscriptionPaid()/the expiry check (subscription.repository.ts)
-- keep it in sync as a coarse "is this store currently on a paid plan"
-- flag — cheap for any future code to check without joining subscription
-- tables, same "reuse what's already there" spirit as this whole project.

create table subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric not null check (price >= 0),
  duration_days int not null check (duration_days > 0),
  -- null = unlimited combos allowed at once (Premium). Not-null caps how
  -- many combos with status = 'active' a store can have simultaneously —
  -- enforced in dashboard/combos/actions.ts at creation time, not here.
  max_active_combos int,
  description text,
  -- Exactly one row should carry this — the plan a store is treated as
  -- being on when it has no store_subscriptions row at all (a brand-new
  -- store, never having bought anything). Not a foreign key anywhere;
  -- looked up by this flag rather than by name string matching.
  is_default boolean not null default false,
  -- Lets admin retire a plan (stop offering it for new purchases) without
  -- deleting it — existing store_subscriptions rows still reference it.
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table store_subscriptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores (id) on delete cascade,
  plan_id uuid not null references subscription_plans (id),
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'active', 'expired', 'cancelled')),
  started_at timestamptz,
  expires_at timestamptz,
  payment_method text check (payment_method in ('vnpay', 'momo')),
  provider_txn_id text,
  amount_paid numeric,
  -- Set the first time a "sắp hết hạn" notification is sent for this row
  -- (subscription.repository.ts's checkAndNotifyExpiringSoon(), called lazily
  -- from the store's own /dashboard/subscription page load — no cron
  -- infrastructure exists in this app, same accepted gap as best-before
  -- locking and Net Zero point expiry) so the same row never re-notifies
  -- on every subsequent page load.
  renewal_notified_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_store_subscriptions_store on store_subscriptions (store_id, created_at desc);

alter table subscription_plans enable row level security;

-- Public-ish read (any signed-in store owner browsing plans to buy) scoped
-- to plans still actually being offered — same "don't show what's not
-- purchasable" spirit as combos_select_public's status = 'active' filter.
create policy subscription_plans_select_active on subscription_plans
  for select using (is_active);

-- No client-facing insert/update policy — plan management is admin-only,
-- always through the service-role client (admin.repository.ts), consistent
-- with every other admin write in this app (0026's posture).

alter table store_subscriptions enable row level security;

-- A store owner can see their own store's subscription history — same
-- ownership-join style as every other store-scoped table in this schema.
create policy store_subscriptions_select_own on store_subscriptions
  for select using (
    exists (select 1 from stores s where s.id = store_subscriptions.store_id and s.owner_id = auth.uid())
  );

-- No insert/update policy at all, on purpose — this table handles money
-- (amount_paid, payment_method, provider_txn_id) and its status transitions
-- are only ever valid when confirmed by a gateway's IPN webhook, so it
-- follows the exact `payments` pattern (.claude/rules/database-and-schema.md):
-- every write (creating a pending purchase, confirming payment, admin
-- overrides) goes through the service-role client, never client RLS.

insert into subscription_plans (name, price, duration_days, max_active_combos, description, is_default, is_active) values
  ('Free', 0, 36500, 5, 'Miễn phí — tối đa 5 combo đang bán cùng lúc.', true, true),
  ('Basic', 99000, 30, 20, 'Tối đa 20 combo đang bán cùng lúc. Gia hạn mỗi 30 ngày.', false, true),
  ('Premium', 299000, 30, null, 'Không giới hạn số combo đang bán cùng lúc. Gia hạn mỗi 30 ngày.', false, true);
