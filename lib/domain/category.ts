export interface Category {
  id: string;
  name: string;
  slug: string;
  defaultLockDurationMinutes: number;
}

// Mirrors supabase/seed.sql. Enforced twice on purpose (defense-in-depth,
// see .claude/rules/business-rules.md): the categories table itself only
// ever contains allowed types, and combo.builder.ts checks against this list
// again so a future edit to the categories table can't silently open the
// door to raw/perishable ingredients.
export const ALLOWED_CATEGORY_SLUGS = [
  "tra-sua-nuoc-uong",
  "ca-phe",
  "banh-ngot-trang-mieng",
  "do-nuong",
  "com-do-an-chin",
  "do-an-vat",
] as const;
