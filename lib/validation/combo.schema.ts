import { z } from "zod";

export const comboItemSchema = z.object({
  itemName: z.string().trim().min(1, "Tên món không được để trống").max(120),
  itemDescription: z.string().trim().max(300).optional(),
  quantity: z.coerce.number().int().min(1).max(50),
});

export const createComboSchema = z
  .object({
    categoryId: z.string().uuid("Vui lòng chọn loại combo"),
    name: z.string().trim().min(2, "Tên combo phải có ít nhất 2 ký tự").max(120),
    description: z.string().trim().max(1000).optional(),
    originalPrice: z.coerce.number().int().min(1000, "Giá gốc tối thiểu 1.000đ"),
    initialStock: z.coerce.number().int().min(1).max(999),
    bestBeforeOverride: z.string().datetime().optional(),
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
