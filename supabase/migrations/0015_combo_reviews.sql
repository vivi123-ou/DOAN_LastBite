-- Additive migration (0001-0014 applied and never edited). New table —
-- genuinely new scope, flagged as such and not built until the user
-- explicitly confirmed they wanted it (see CLAUDE.md §7, "Explicitly not
-- built" note under the Net Zero round).
--
-- One table for both reviews and reports (`kind`), not two, since they
-- share the same shape (one submission per customer per order item, tied
-- to the same combo/store/order) and the same eligibility rule (only after
-- the order is completed) — a `kind` discriminator is simpler than two
-- near-identical tables. `rating` is required for a review and forbidden
-- for a report (a report is a complaint, not a star rating).

create table combo_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  order_item_id uuid not null references order_items (id) on delete cascade,
  combo_id uuid not null references combos (id) on delete cascade,
  customer_id uuid not null references profiles (id) on delete cascade,
  store_id uuid not null references stores (id) on delete cascade,
  kind text not null default 'review' check (kind in ('review', 'report')),
  rating smallint check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  constraint combo_reviews_rating_matches_kind check (
    (kind = 'review' and rating is not null) or (kind = 'report' and rating is null)
  ),
  -- One submission per customer per order line — re-buying the same combo
  -- in a later order is a separate order_item, so a fresh review is fine.
  unique (order_item_id, customer_id)
);

create index idx_combo_reviews_combo on combo_reviews (combo_id);
create index idx_combo_reviews_store on combo_reviews (store_id);
create index idx_combo_reviews_customer on combo_reviews (customer_id);

alter table combo_reviews enable row level security;

-- Reviews (not reports — a complaint isn't a public product page fact) are
-- publicly readable, same "show the real thing" spirit as combo_images/
-- combo_items — .claude/rules/business-rules.md's "no mystery bags"
-- extends naturally to "no hidden bad reviews" too.
create policy combo_reviews_select_public on combo_reviews
  for select using (kind = 'review');

create policy combo_reviews_select_own on combo_reviews
  for select using (customer_id = auth.uid());

-- Store owners need to see reports too (that's the whole point of a
-- report), via the same store-ownership join style used everywhere else
-- in this schema's RLS.
create policy combo_reviews_select_store_owner on combo_reviews
  for select using (
    exists (select 1 from stores s where s.id = combo_reviews.store_id and s.owner_id = auth.uid())
  );

create policy combo_reviews_insert_own on combo_reviews
  for insert with check (customer_id = auth.uid());

create policy combo_reviews_update_own on combo_reviews
  for update using (customer_id = auth.uid());
