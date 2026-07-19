import type { Combo } from "@/lib/domain/combo";
import type { PricingStrategy } from "@/lib/pricing/strategies/pricing-strategy.interface";

// Phase 1 default: price never moves after creation. Replace the resolution
// in pricing-strategy.factory.ts with StockBasedDecayStrategy in phase 3 —
// combos.pricing_strategy already carries the column needed to switch per-combo.
export class FixedPriceStrategy implements PricingStrategy {
  calculatePrice(combo: Combo): number {
    return combo.currentPrice;
  }
}
