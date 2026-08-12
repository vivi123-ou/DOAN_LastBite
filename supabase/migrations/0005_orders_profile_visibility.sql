-- Additive migration (see .claude/rules/database-and-schema.md — 0001-0004
-- are never edited).
--
-- Store owners need to see the name/phone of a customer who placed an order
-- with them, to actually fulfill it (hand over a pickup, coordinate
-- delivery). profiles_select_own (0001) only lets a user read their own
-- row. This adds a narrowly-scoped exception, in the same ownership-join
-- style as the rest of the schema's RLS — visible only for customers who
-- have an order with that specific store, never a blanket
-- "stores can read all profiles" policy.

create policy profiles_select_by_order_store_owner on profiles for select
  using (
    exists (
      select 1 from orders o
      join stores s on s.id = o.store_id
      where o.customer_id = profiles.id and s.owner_id = auth.uid()
    )
  );
