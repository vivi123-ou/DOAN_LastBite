import type { Category } from "@/lib/domain/category";

// Deliberately a plain function, not a Strategy class — this is a data
// lookup (categories.default_lock_duration_minutes), not an algorithm that
// varies polymorphically. See .claude/rules/stack-and-conventions.md.
export function suggestBestBefore(category: Category, from: Date = new Date()): Date {
  return new Date(from.getTime() + category.defaultLockDurationMinutes * 60_000);
}
