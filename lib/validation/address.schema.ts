import { z } from "zod";

export const saveAddressSchema = z.object({
  label: z.string().trim().max(50).optional(),
  addressLine: z.string().trim().min(5, "Vui lòng nhập địa chỉ đầy đủ").max(300),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});
