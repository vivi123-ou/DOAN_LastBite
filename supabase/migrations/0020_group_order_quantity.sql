-- Additive migration (0001-0019 applied and never edited). Needed for the
-- bulk-discount-tier checkout integration: without a per-participant
-- quantity, a group order had no way to know how many units the group
-- actually wants in total, only a headcount — bulk_discount_tiers keys off
-- min_quantity, not participant count.
alter table group_order_participants
  add column quantity integer not null default 1 check (quantity > 0);
