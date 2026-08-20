-- Additive migration (0001-0016 applied and never edited). Fixes a real
-- design gap the user caught live: a freshly-listed combo was already
-- showing ~25%+ off the instant it went on sale, before any time had
-- passed or any stock had sold. Root cause was 0016's formula weighting
-- timeUrgency and stockPressure as a 50/50 average
-- (0.5*timeUrgency + 0.5*stockPressure) — since a brand-new combo always
-- has stockPressure = 1.0 (nothing could have sold yet), that alone
-- contributed a fixed 25%-of-max discount (0.5 * 0.5 * original_price)
-- regardless of how new the listing was.
--
-- Fix: decayFactor is now timeUrgency * stockPressure (multiplied, not
-- averaged) — see the matching comment in
-- lib/pricing/strategies/stock-based-decay.strategy.ts for the full
-- reasoning. timeUrgency = 0 now forces decayFactor = 0 no matter what
-- stockPressure is, so a combo genuinely starts at 0% off the moment it's
-- listed, and only decays as real time elapses *and* stock is still
-- sitting unsold.
--
-- Only dynamic_combo_price() itself needs replacing — nearby_combos() and
-- search_combos() (0016) just call it by name, so fixing the one helper
-- function fixes both RPCs without touching their bodies again.

create or replace function dynamic_combo_price(
  original_price numeric,
  initial_stock int,
  remaining_stock int,
  created_at timestamptz,
  best_before timestamptz,
  as_of timestamptz default now()
) returns numeric
language sql stable as $$
  select round(
    original_price * (
      1 - 0.5 * (
        -- timeUrgency: how far through created_at→best_before `as_of`
        -- already is, clamped to [0,1].
        least(1.0, greatest(0.0,
          case when best_before <= created_at then 1.0
          else extract(epoch from (as_of - created_at))
               / extract(epoch from (best_before - created_at))
          end
        ))
        -- multiplied (not added) by stockPressure: how much of the
        -- original stock is still unsold, clamped to [0,1]. A combo with
        -- zero elapsed time has stockPressure = 1 but timeUrgency = 0, so
        -- the product — and the discount — is correctly 0.
        * least(1.0, greatest(0.0,
          case when initial_stock <= 0 then 0.0
          else remaining_stock::numeric / initial_stock
          end
        ))
      )
    ) / 500
  ) * 500;
$$;
