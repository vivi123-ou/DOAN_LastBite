import { z } from "zod";
import {
  MIN_MAX_DISCOUNT_PCT,
  MAX_MAX_DISCOUNT_PCT,
  DEFAULT_MAX_DISCOUNT_PCT,
} from "@/lib/pricing/strategies/stock-based-decay.strategy";

export const comboItemSchema = z.object({
  itemName: z.string().trim().min(1, "Tên món không được để trống").max(120),
  itemDescription: z.string().trim().max(300).optional(),
  quantity: z.coerce
    .number()
    .int("Số lượng phải là số nguyên")
    .min(1, "Số lượng phải từ 1 trở lên")
    .max(50, "Số lượng tối đa 50 mỗi món"),
});

export const createComboSchema = z
  .object({
    categoryId: z.string().uuid("Vui lòng chọn loại combo"),
    name: z.string().trim().min(2, "Tên combo phải có ít nhất 2 ký tự").max(120),
    description: z.string().trim().max(1000).optional(),
    originalPrice: z.coerce
      .number()
      .int("Giá gốc phải là số nguyên")
      .min(1000, "Giá gốc tối thiểu 1.000đ")
      .max(50_000_000, "Giá gốc tối đa 50.000.000đ"),
    initialStock: z.coerce
      .number()
      .int("Số lượng phải là số nguyên")
      .min(1, "Số lượng ban đầu phải từ 1 trở lên")
      .max(999, "Số lượng ban đầu tối đa 999 phần mỗi combo"),
    // Only a shape/not-in-the-past check here — the upper bound depends on
    // the category's default_lock_duration_minutes, which isn't known at
    // this layer. The authoritative range check (must not be later than the
    // category's suggested Best Before) runs in combo.builder.ts, where the
    // resolved Category is available.
    bestBeforeOverride: z
      .string()
      .datetime()
      .optional()
      .refine((value) => !value || new Date(value).getTime() > Date.now() - 5 * 60_000, {
        message: "Giờ khoá bán không được ở quá khứ",
      }),
    // Store-owner-chosen dynamic-pricing ceiling — see
    // stock-based-decay.strategy.ts for why this is a one-time-set ceiling,
    // not a live per-hour dial.
    maxDiscountPct: z.coerce
      .number()
      .min(MIN_MAX_DISCOUNT_PCT, `Mức giảm tối đa tối thiểu ${MIN_MAX_DISCOUNT_PCT}%`)
      .max(MAX_MAX_DISCOUNT_PCT, `Mức giảm tối đa tối đa ${MAX_MAX_DISCOUNT_PCT}%`)
      .default(DEFAULT_MAX_DISCOUNT_PCT),
    deliverySupported: z.boolean(),
    pickupSupported: z.boolean(),
    items: z.array(comboItemSchema).min(1, "Combo phải có ít nhất 1 món"),
    imageUrls: z.array(z.string().url()).default([]),
  })
  .refine((data) => data.deliverySupported || data.pickupSupported, {
    message: "Combo phải hỗ trợ ít nhất một hình thức: giao hàng hoặc tự đến lấy",
    path: ["pickupSupported"],
  });

export type CreateComboFormValues = z.infer<typeof createComboSchema>;

// Backs the bulk "Bán lại hàng loạt" flow — one row per selected combo,
// each carrying just the two fields a relist genuinely needs (see
// combo.repository.ts's relist() for why this is deliberately narrower
// than createComboSchema). `bestBefore` has no upper-bound check here the
// way createComboSchema's does — the client already computes/clamps it
// against each combo's own category-suggested maximum before submitting
// (bulk-relist-dialog.tsx), so by the time this reaches the server it's
// already a valid choice; re-deriving the category here just to re-check
// would mean an extra query per row for a case the UI already prevents.
export const bulkRelistItemSchema = z.object({
  comboId: z.string().uuid(),
  initialStock: z.coerce
    .number()
    .int("Số lượng phải là số nguyên")
    .min(1, "Số lượng phải từ 1 trở lên")
    .max(999, "Số lượng tối đa 999 phần mỗi combo"),
  bestBefore: z.string().datetime(),
});

export const bulkRelistSchema = z.object({
  items: z.array(bulkRelistItemSchema).min(1, "Chưa chọn combo nào"),
});

export type BulkRelistFormValues = z.infer<typeof bulkRelistSchema>;
