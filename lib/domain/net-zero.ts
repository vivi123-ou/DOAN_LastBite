export interface NetZeroSummary {
  pointsBalance: number;
  totalCo2SavedKg: number;
}

// The soonest still-unexpired batch of earned points and when it expires —
// see net-zero.repository.ts's getNextExpiry(). Null when the customer has
// no unexpired earn history to show a date for (e.g. balance is entirely
// from a manual/demo adjustment rather than a real order, or genuinely no
// points earned yet).
export interface NetZeroExpiry {
  date: string;
  points: number;
}

// Premium-tier store perk (subscription_plans.tier='premium', 0031) — a
// store's own contribution to the platform's Net Zero mission, not the
// customer-facing balance. Reuses the exact same co2_factors×quantity data
// net_zero_ledger already records per paid order, just aggregated by store
// instead of by customer.
export interface StoreNetZeroImpact {
  totalCo2SavedKg: number;
  totalFoodRescuedKg: number;
  orderCount: number;
}
