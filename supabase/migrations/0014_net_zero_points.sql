-- Additive migration (0001-0013 applied and never edited). Gives the
-- previously-dormant Net Zero tracking (co2_factors/net_zero_ledger, 0001)
-- an actual redeemable-points mechanic on top, per explicit request — the
-- ledger by itself only ever tracked kg CO2 saved, never anything a
-- customer could act on.
--
-- profiles.net_zero_points is a running balance, not a full transaction
-- ledger — same "simple counter, not a fully audited log" tradeoff already
-- accepted elsewhere in this schema (stock decrement is a plain update, not
-- a row-locked function; see order.builder.ts's own comment on this).
-- orders.net_zero_points_used records how many points were redeemed on
-- that specific order, needed to refund the right amount if the order is
-- later rejected/cancelled (mirrors restoreStock()'s same rejected/
-- cancelled refund trigger in order.repository.ts).

alter table profiles add column net_zero_points integer not null default 0 check (net_zero_points >= 0);
alter table orders add column net_zero_points_used integer not null default 0 check (net_zero_points_used >= 0);
