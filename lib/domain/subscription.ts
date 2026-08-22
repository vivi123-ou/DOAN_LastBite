export type SubscriptionTier = "free" | "basic" | "premium";

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  maxActiveCombos: number | null;
  // Independent of `name` — a plan's tier decides what features it
  // unlocks; `name` (and `durationDays`) can differ between a monthly and
  // yearly variant of the *same* tier (0031's "Premium"/"Premium (năm)").
  tier: SubscriptionTier;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export type SubscriptionStatus = "pending_payment" | "active" | "expired" | "cancelled";

export interface StoreSubscription {
  id: string;
  storeId: string;
  planId: string;
  planName: string;
  status: SubscriptionStatus;
  startedAt: string | null;
  expiresAt: string | null;
  amountPaid: number | null;
}

// The plan/limit a store is *actually* subject to right now — resolved from
// its most recent store_subscriptions row (or the seeded default/"Free"
// plan if it has none yet). See subscription.repository.ts's
// getEffectiveSubscription() for the resolution logic itself.
export interface EffectiveSubscription {
  planName: string;
  tier: SubscriptionTier;
  maxActiveCombos: number | null;
  // True only when a store had a paid (non-default) plan that has expired
  // and hasn't been renewed — per the business rule, this fully blocks
  // creating new combos until renewed (not a downgrade-to-Free fallback).
  locked: boolean;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
}

export interface AdminStoreSubscriptionSummary {
  storeId: string;
  storeName: string;
  planName: string;
  status: SubscriptionStatus;
  startedAt: string | null;
  expiresAt: string | null;
  amountPaid: number | null;
}
