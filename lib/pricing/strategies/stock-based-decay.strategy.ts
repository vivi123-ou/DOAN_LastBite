import type { Combo } from "@/lib/domain/combo";
import type { PricingStrategy } from "@/lib/pricing/strategies/pricing-strategy.interface";

// Phase 3 dynamic pricing. Per .claude/rules/business-rules.md: "must be
// recomputed continuously from remaining stock and elapsed time... not
// stepped down at fixed clock times... so customers can't 'wait out the
// clock' for a guaranteed discount." Every call recomputes from scratch
// against `now` — nothing here is ever written back to combos.current_price,
// so there is no fixed step to wait out, only a number that keeps moving.
//
// Multiplied, not averaged, between two [0,1] pressures:
//  - timeUrgency: how far through the combo's own created_at→best_before
//    window `now` already is (0 = just listed, 1 = at/after best_before).
//  - stockPressure: how much of the original stock is still unsold
//    (1 = nothing sold yet, 0 = sold out) — a combo that's already selling
//    well doesn't need as deep a push as one still sitting full right before
//    it locks.
// decayFactor = timeUrgency * stockPressure — multiplicative on purpose
// (an earlier version weighted-averaged the two instead, 0.5*timeUrgency +
// 0.5*stockPressure, which meant a combo with *zero* elapsed time already
// carried a fixed 25%-off the instant it was listed, since stockPressure is
// always 1.0 for a brand-new combo — nothing could have sold yet. That's
// wrong: a combo that's one second old hasn't had a chance to sell,
// regardless of how much stock it started with, so day-zero discount must
// be 0%. Multiplying instead of averaging makes timeUrgency = 0 force
// decayFactor = 0 no matter what stockPressure is, and only lets the
// discount actually grow once real time has elapsed *and* stock is still
// sitting unsold — exactly "giảm dần theo thời gian, sâu hơn nếu ế hàng."
// Floor is 50% of original_price (MAX_DISCOUNT_PCT below) — dynamic pricing
// clears inventory, it doesn't give food away for free; that's what Net
// Zero point redemption (lib/pricing/net-zero/net-zero.policy.ts) is for,
// applied as a separate discount on top at checkout.
//
// Keep this formula in sync with dynamic_combo_price() in
// supabase/migrations/0025_combo_max_discount.sql — that SQL copy exists
// because nearby_combos()/search_combos() are index-backed PostGIS RPCs
// (.claude/rules/database-and-schema.md) and can't call into this TS class;
// duplicated on purpose, same accepted-tradeoff shape as the sequential
// stock decrement noted in order.builder.ts.
//
// The ceiling used to be a single hardcoded 0.5 (50%) for every combo —
// now it's `combos.max_discount_pct`, a store-owner-chosen value per combo
// (10-70%, see combo-form.tsx). Deliberately still just ONE number, set
// once at listing time, not a live per-hour dial the store can spin — the
// mandatory business rule (business-rules.md: "never a fixed-time discount
// step... so customers can't wait out the clock") only cares that the
// *moment-to-moment* price stays unpredictable; a store picking how deep
// their own ceiling goes doesn't reintroduce that problem, since the
// continuous time×stock curve below the ceiling is untouched.
export const MIN_MAX_DISCOUNT_PCT = 10;
export const MAX_MAX_DISCOUNT_PCT = 70;
export const DEFAULT_MAX_DISCOUNT_PCT = 50;

export interface DecayPricingInput {
  originalPrice: number;
  initialStock: number;
  remainingStock: number;
  createdAt: string | Date;
  bestBefore: string | Date;
  // Percentage (10-70), not a fraction — matches how it's stored in
  // combos.max_discount_pct and how the SQL copy takes it.
  maxDiscountPct: number;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

// Exported standalone so lighter-weight repository read shapes
// (ComboSnapshot, StoreComboSummary) that aren't a full domain Combo can
// reuse the exact same math as StockBasedDecayStrategy below without
// building a throwaway Combo object just to call calculatePrice(). Every
// combo in this app is created with pricing_strategy = 'stock_based_decay'
// (combo.builder.ts never overrides the DB default, and there's no UI to
// change it), so these lighter paths skip the resolvePricingStrategy()
// dispatch and call this directly — the polymorphic factory is still used
// end to end for the full-Combo hydrate() path in combo.repository.ts.
export function computeStockBasedDecayPrice(
  input: DecayPricingInput,
  now: Date = new Date()
): number {
  const createdAt = new Date(input.createdAt);
  const bestBefore = new Date(input.bestBefore);

  const windowMs = bestBefore.getTime() - createdAt.getTime();
  const timeUrgency =
    windowMs <= 0 ? 1 : clamp01((now.getTime() - createdAt.getTime()) / windowMs);

  const stockPressure =
    input.initialStock <= 0 ? 0 : clamp01(input.remainingStock / input.initialStock);

  const decayFactor = timeUrgency * stockPressure;
  const raw = input.originalPrice * (1 - (input.maxDiscountPct / 100) * decayFactor);

  // Round to the nearest 500đ for a clean displayed price.
  return Math.round(raw / 500) * 500;
}

export class StockBasedDecayStrategy implements PricingStrategy {
  calculatePrice(combo: Combo, now: Date): number {
    return computeStockBasedDecayPrice(
      {
        originalPrice: combo.originalPrice,
        initialStock: combo.initialStock,
        remainingStock: combo.remainingStock,
        createdAt: combo.createdAt,
        bestBefore: combo.bestBefore,
        maxDiscountPct: combo.maxDiscountPct,
      },
      now
    );
  }
}
