import type { PricingStrategy } from "@/lib/pricing/strategies/pricing-strategy.interface";
import { FixedPriceStrategy } from "@/lib/pricing/strategies/fixed-price.strategy";

const fixedPrice = new FixedPriceStrategy();

// combos.pricing_strategy defaults to 'stock_based_decay' at the DB level
// (see 0001_init_schema.sql) so no migration is needed when phase 3 adds
// the real StockBasedDecayStrategy here — only this resolver changes.
export function resolvePricingStrategy(strategyName: string): PricingStrategy {
  switch (strategyName) {
    case "stock_based_decay":
    default:
      return fixedPrice;
  }
}
