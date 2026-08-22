import { z } from "zod";

// min_quantity > 1 and discount_pct 0-100 mirror bulk_discount_tiers' own
// check constraints (0001) exactly — this is defense-in-depth validation
// with a real Vietnamese message, not the DB's raw constraint-violation
// error leaking to the UI.
export const bulkDiscountTierSchema = z.object({
  minQuantity: z.coerce
    .number()
    .int("Số lượng tối thiểu phải là số nguyên")
    .min(2, "Số lượng tối thiểu phải từ 2 trở lên")
    .max(999, "Số lượng tối thiểu tối đa 999"),
  discountPct: z.coerce
    .number()
    .min(0, "Mức giảm không được âm")
    .max(100, "Mức giảm không được quá 100%"),
});
