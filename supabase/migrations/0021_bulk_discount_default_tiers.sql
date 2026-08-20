-- Additive migration (0001-0020 applied and never edited). Seeds a
-- platform-wide default tier set (store_id = null) into the dormant
-- bulk_discount_tiers table so the group-buy checkout discount (just wired
-- up this round) has something real to apply immediately — no store owner
-- has ever had a way to configure their own tiers yet (that management UI
-- doesn't exist — see CLAUDE.md's "Phase 4 remaining work"), so without
-- this seed, every group order would resolve zero tiers and the whole
-- feature would be untestable. `bulk_discount_tiers_all_owner` RLS (0001)
-- already lets a store owner insert their own store-specific tiers later —
-- store-specific tiers, once any exist for a store, take precedence over
-- this default (see bulk-discount.repository.ts's listTiersForStore()).
--
-- `on conflict do nothing` with no unique constraint to conflict on would
-- error, so this is guarded with a not-exists check instead — safe to
-- re-run without duplicating rows if this migration is ever run twice.
insert into bulk_discount_tiers (store_id, min_quantity, discount_pct)
select null, tier.min_quantity, tier.discount_pct
from (values (3, 5), (5, 10), (10, 15)) as tier(min_quantity, discount_pct)
where not exists (
  select 1 from bulk_discount_tiers where store_id is null
);
