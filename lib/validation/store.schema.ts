import { z } from "zod";

// Same pattern as profile.schema.ts's phone field — kept duplicated rather
// than factored into a shared helper for two small, independent schemas.
const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9+ ]{8,15}$/, "Số điện thoại không hợp lệ")
  .optional()
  .or(z.literal(""));

export const registerStoreSchema = z.object({
  name: z.string().trim().min(2, "Tên cửa hàng phải có ít nhất 2 ký tự").max(120),
  description: z.string().trim().max(1000).optional(),
  addressLine: z.string().trim().min(5, "Vui lòng nhập địa chỉ đầy đủ").max(300),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  phone: phoneSchema,
});

export type RegisterStoreFormValues = z.infer<typeof registerStoreSchema>;

// Same field set as registerStoreSchema plus the two images — kept as a
// separate schema (not registerStoreSchema.extend(...)) since the two
// forms genuinely submit to different actions with different required
// fields going forward (see store-form-fields.tsx for the shared UI both
// forms render).
export const updateStoreSchema = z.object({
  name: z.string().trim().min(2, "Tên cửa hàng phải có ít nhất 2 ký tự").max(120),
  description: z.string().trim().max(1000).optional(),
  addressLine: z.string().trim().min(5, "Vui lòng nhập địa chỉ đầy đủ").max(300),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  logoUrl: z.string().url().nullable().optional(),
  bannerUrl: z.string().url().nullable().optional(),
  phone: phoneSchema,
});

export type UpdateStoreFormValues = z.infer<typeof updateStoreSchema>;
