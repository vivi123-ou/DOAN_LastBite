-- Closes the last gap in the payout flow: admin.repository.ts's
-- store_payouts (0028) already computes exactly how much a store is owed,
-- but there was nowhere in the system recording *where* to actually send
-- it — the admin had to ask the store owner out of band every time.
--
-- A separate table, not new columns on `stores` — deliberately, not
-- incidentally. `stores` already has a public read policy
-- (`stores_select_public`, 0001) used by every customer-facing page via
-- plain `select("*")` calls (store.repository.ts's getById(), the map's
-- store-detail panel) — bank account details are genuinely sensitive
-- financial data that must never ride along on one of those public reads.
-- Keeping it in its own table with its own narrow RLS follows the exact
-- "payments pattern" already established in this schema
-- (.claude/rules/database-and-schema.md): money-adjacent data gets its own
-- tight policy, not folded into a table that already has a broad public
-- read.
create table store_bank_accounts (
  store_id uuid primary key references stores (id) on delete cascade,
  bank_name text,
  account_number text,
  account_holder text,
  updated_at timestamptz not null default now()
);

alter table store_bank_accounts enable row level security;

-- Store owner can read/write only their own row (same-actor, regular
-- client) — same ownership-join shape used everywhere else in this schema.
-- No public select policy at all, and no admin-facing write policy either:
-- admin only ever *reads* this (for /admin/payouts), via the service-role
-- client, which bypasses RLS by design.
create policy store_bank_accounts_select_own on store_bank_accounts
  for select using (
    exists (select 1 from stores s where s.id = store_bank_accounts.store_id and s.owner_id = auth.uid())
  );

create policy store_bank_accounts_insert_own on store_bank_accounts
  for insert with check (
    exists (select 1 from stores s where s.id = store_bank_accounts.store_id and s.owner_id = auth.uid())
  );

create policy store_bank_accounts_update_own on store_bank_accounts
  for update using (
    exists (select 1 from stores s where s.id = store_bank_accounts.store_id and s.owner_id = auth.uid())
  );
