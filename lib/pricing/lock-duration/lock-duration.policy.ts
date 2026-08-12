import type { Category } from "@/lib/domain/category";

// Deliberately a plain function, not a Strategy class — this is a data
// lookup (categories.default_lock_duration_minutes), not an algorithm that
// varies polymorphically. See .claude/rules/stack-and-conventions.md.
export function suggestBestBefore(category: Category, from: Date = new Date()): Date {
  return new Date(from.getTime() + category.defaultLockDurationMinutes * 60_000);
}

// Combos are end-of-day surplus food, not a general listing — a store owner
// manually overriding Best Before still shouldn't be able to pick a date far
// in the future. 24h covers the "selling past midnight" case (e.g. a combo
// created at 11pm locking at 6am the next day) without allowing arbitrary
// long-lived listings. Enforced both in the UI (combo-form.tsx min/max on
// the datetime picker) and here in validation (combo.schema.ts) as the
// source of truth for the limit.
export const MAX_BEST_BEFORE_HOURS = 24;

// A few minutes of slack on the lower bound absorbs the gap between the
// browser picking "now" and the server validating the submitted request.
const PAST_GRACE_MINUTES = 5;

export function isWithinAllowedBestBeforeRange(candidate: Date, from: Date = new Date()): boolean {
  const earliest = new Date(from.getTime() - PAST_GRACE_MINUTES * 60_000);
  const latest = new Date(from.getTime() + MAX_BEST_BEFORE_HOURS * 60 * 60_000);
  return candidate >= earliest && candidate <= latest;
}
