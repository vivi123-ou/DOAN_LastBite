import { z } from "zod";

export const createPlacementTypeSchema = z.object({
  key: z.enum(["hot_deal", "search_top", "category_top", "homepage_banner", "diamond_partner"]),
  name: z.string().trim().min(2, "Tên gói phải có ít nhất 2 ký tự").max(120),
  description: z.string().trim().max(500).optional(),
  price: z.coerce.number().int().min(0, "Giá không được âm").max(50_000_000, "Giá tối đa 50.000.000đ"),
  durationDays: z.coerce.number().int().min(1, "Thời hạn tối thiểu 1 ngày").max(3650, "Thời hạn tối đa 3650 ngày"),
});

export const bookAdSchema = z
  .object({
    placementTypeId: z.string().uuid(),
    comboId: z.string().uuid().optional(),
    radiusM: z.coerce.number().int().min(500).max(50_000).optional(),
    bannerImageUrl: z.string().url().optional(),
    linkUrl: z.string().max(500).optional(),
  })
  .strict();
