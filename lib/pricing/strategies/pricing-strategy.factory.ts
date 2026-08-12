import type { PricingStrategy } from "@/lib/pricing/strategies/pricing-strategy.interface";
import { FixedPriceStrategy } from "@/lib/pricing/strategies/fixed-price.strategy";
import { StockBasedDecayStrategy } from "@/lib/pricing/strategies/stock-based-decay.strategy";

const fixedPrice = new FixedPriceStrategy();
const stockBasedDecay = new StockBasedDecayStrategy();

// combos.pricing_strategy defaults to 'stock_based_decay' at the DB level
// (see 0001_init_schema.sql) and no combo-creation UI ever overrides it, so
// this is the live resolution for every combo in the app today.
// FixedPriceStrategy stays resolvable via an explicit 'fixed' value (never
// written by app code, but kept selectable here — it costs nothing to leave
// wired up and gives a manual escape hatch if a store ever needs a price
// that truly never moves).
export function resolvePricingStrategy(strategyName: string): PricingStrategy {
  switch (strategyName) {
    case "fixed":
      return fixedPrice;
    case "stock_based_decay":
    default:
      return stockBasedDecay;
  }
}
