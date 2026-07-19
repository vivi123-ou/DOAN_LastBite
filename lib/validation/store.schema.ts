import { z } from "zod";

export const registerStoreSchema = z.object({
  name: z.string().trim().min(2, "Tên cửa hàng phải có ít nhất 2 ký tự").max(120),
  description: z.string().trim().max(1000).optional(),
  addressLine: z.string().trim().min(5, "Vui lòng nhập địa chỉ đầy đủ").max(300),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export type RegisterStoreFormValues = z.infer<typeof registerStoreSchema>;
