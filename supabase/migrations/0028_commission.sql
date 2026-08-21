-- Module 2/3 of the admin build-out: Hoa hồng & Đối soát Tài chính
-- (commission rate + reconciliation/payout tracking). Additive only, per
-- .claude/rules/database-and-schema.md — 0001-0027 untouched.

-- Singleton platform commission-rate config. Readable by anyone (store
-- owners should be able to see what rate they're charged — same
-- transparency spirit as bulk_discount_tiers being a plain readable table),
-- but only the admin can change it, via the service-role client — same
-- "payments pattern" as subscription_plans (0027): no client write policy.
create table commission_config (
  id uuid primary key default gen_random_uuid(),
  commission_pct numeric not null default 8 check (commission_pct >= 0 and commission_pct <= 100),
  updated_at timestamptz not null default now()
);

alter table commission_config enable row level security;
create policy commission_config_select_all on commission_config for select using (true);
-- no insert/update policy — admin-only via service-role

insert into commission_config (commission_pct) values (8);

-- An admin-generated reconciliation snapshot: what a store is owed for one
-- period (gross revenue from completed orders in that range, minus the
-- platform commission at the rate in effect when generated). Tracked
-- 'pending' -> 'paid' once an admin has actually done the bank transfer by
-- hand. No automated payout rail exists in this app (no VietQR/PayOS/Casso
-- integration was ever authorized/built) — this table is deliberately a
-- manual reconciliation list, not a payment mechanism.
create table store_payouts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  order_count int not null default 0,
  gross_revenue numeric not null default 0,
  commission_pct numeric not null,
  commission_amount numeric not null default 0,
  net_payout_amount numeric not null default 0,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  paid_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now()
);

create index idx_store_payouts_store on store_payouts (store_id, created_at desc);

alter table store_payouts enable row level security;
-- Same ownership-join shape used everywhere else in this schema — a store
-- owner can see their own payout/reconciliation history for transparency.
create policy store_payouts_select_own on store_payouts
  for select using (
    exists (select 1 from stores s where s.id = store_payouts.store_id and s.owner_id = auth.uid())
  );
-- no insert/update policy at all — admin-only via service-role, same
-- posture as payments itself (database-and-schema.md).
