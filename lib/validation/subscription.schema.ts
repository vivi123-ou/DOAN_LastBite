import { z } from "zod";

export const createPlanSchema = z.object({
  name: z.string().trim().min(2, "Tên gói phải có ít nhất 2 ký tự").max(60),
  price: z.coerce.number().int("Giá phải là số nguyên").min(0, "Giá không được âm").max(50_000_000),
  durationDays: z.coerce
    .number()
    .int("Số ngày phải là số nguyên")
    .min(1, "Thời hạn tối thiểu 1 ngày")
    .max(3650, "Thời hạn tối đa 3650 ngày"),
  // Empty string from a number input means "không giới hạn" — coerced to
  // null, matching subscription_plans.max_active_combos's own null =
  // unlimited convention.
  maxActiveCombos: z
    .union([z.literal(""), z.coerce.number().int().min(1).max(9999)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  description: z.string().trim().max(500).optional(),
});

export type CreatePlanFormValues = z.infer<typeof createPlanSchema>;
