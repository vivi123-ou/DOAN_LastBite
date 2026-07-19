import type { Combo } from "@/lib/domain/combo";

// Phase 3 (Dynamic Pricing). Real polymorphism lives here because the
// algorithm genuinely varies per combo.pricing_strategy — see
// .claude/rules/stack-and-conventions.md for why this gets a Strategy and
// the lock-duration default doesn't.
export interface PricingStrategy {
  calculatePrice(combo: Combo, now: Date): number;
}
