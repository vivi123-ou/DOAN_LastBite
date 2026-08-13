-- Additive migration (0001-0022 applied and never edited). Orders only ever
-- carried their *current* status, with no record of when each transition
-- actually happened — the user asked for a Shopee/Fahasa-style timeline
-- ("vào lúc mấy giờ, đã tới trạng thái nào") on both the customer order
-- detail page and the store's incoming-orders dashboard, which needs a real
-- per-status timestamp history, not just the single current status column.
create table order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  status text not null
    check (status in ('pending', 'accepted', 'rejected', 'preparing', 'ready', 'completed', 'cancelled')),
  changed_at timestamptz not null default now()
);

create index idx_order_status_history_order_id on order_status_history (order_id, changed_at);

alter table order_status_history enable row level security;

-- Same visibility as the parent order itself: the customer who placed it,
-- or the owner of the store it was placed at — ownership join, same style
-- as the rest of this schema's RLS (no duplicated customer_id/owner_id
-- column on this table).
create policy order_status_history_select on order_status_history
  for select using (
    exists (
      select 1 from orders o
      where o.id = order_status_history.order_id
        and (
          o.customer_id = auth.uid()
          or exists (select 1 from stores s where s.id = o.store_id and s.owner_id = auth.uid())
        )
    )
  );

-- The initial 'pending' row is written at order creation, which already
-- runs on the service-role client (order.repository.ts's create() — a
-- cross-actor write, see database-and-schema.md's "payments pattern"), so
-- that path doesn't need a client-facing insert policy. Every *subsequent*
-- transition, though, is the store owner advancing their own incoming
-- order (updateStatus(), regular client, orders_update_store_owner RLS) —
-- this policy lets that same regular-client call also record the history
-- row, instead of needing to switch that whole flow to the admin client
-- just for this one insert.
create policy order_status_history_insert_store_owner on order_status_history
  for insert with check (
    exists (
      select 1 from orders o
      join stores s on s.id = o.store_id
      where o.id = order_status_history.order_id and s.owner_id = auth.uid()
    )
  );
