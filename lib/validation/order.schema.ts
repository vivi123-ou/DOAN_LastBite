import { z } from "zod";

export const checkoutItemSchema = z.object({
  comboId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(50),
});

export const checkoutSchema = z
  .object({
    storeId: z.string().uuid(),
    fulfillmentType: z.enum(["pickup", "delivery"]),
    deliveryAddressLine: z.string().trim().min(5, "Vui lòng nhập địa chỉ đầy đủ").optional(),
    deliveryLat: z.number().min(-90).max(90).optional(),
    deliveryLng: z.number().min(-180).max(180).optional(),
    items: z.array(checkoutItemSchema).min(1, "Giỏ hàng đang trống"),
  })
  .refine(
    (data) =>
      data.fulfillmentType === "pickup" ||
      (data.deliveryAddressLine && data.deliveryLat !== undefined && data.deliveryLng !== undefined),
    {
      message: "Vui lòng nhập địa chỉ giao hàng",
      path: ["deliveryAddressLine"],
    }
  );

export type CheckoutFormValues = z.infer<typeof checkoutSchema>;
