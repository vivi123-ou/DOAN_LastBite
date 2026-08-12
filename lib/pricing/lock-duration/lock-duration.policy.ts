import type { Category } from "@/lib/domain/category";

// Deliberately a plain function, not a Strategy class — this is a data
// lookup (categories.default_lock_duration_minutes), not an algorithm that
// varies polymorphically. See .claude/rules/stack-and-conventions.md.
export function suggestBestBefore(category: Category, from: Date = new Date()): Date {
  return new Date(from.getTime() + category.defaultLockDurationMinutes * 60_000);
}

// A few minutes of slack on the lower bound absorbs the gap between the
// browser picking "now" and the server validating the submitted request.
const PAST_GRACE_MINUTES = 5;

// A store owner manually overriding Best Before can only lock EARLIER than
// the category's auto-suggested time, never later — suggestBestBefore()
// already represents the food-safety-appropriate maximum for that food type
// (e.g. trà sữa ~2h, đồ nướng ~4h). Allowing an override past that would
// defeat the whole point of the per-category default. Enforced both in the
// UI (combo-form.tsx min/max on the date/time pickers) and here — the
// authoritative check, applied in combo.builder.ts where the resolved
// Category is available.
export function isWithinAllowedBestBeforeRange(
  candidate: Date,
  category: Category,
  from: Date = new Date()
): boolean {
  const earliest = new Date(from.getTime() - PAST_GRACE_MINUTES * 60_000);
  const latest = suggestBestBefore(category, from);
  return candidate >= earliest && candidate <= latest;
}
