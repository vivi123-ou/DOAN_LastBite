import { z } from "zod";

export const updateCommissionRateSchema = z.object({
  commissionPct: z.coerce
    .number()
    .min(0, "Tỷ lệ hoa hồng phải từ 0% trở lên")
    .max(100, "Tỷ lệ hoa hồng không được vượt quá 100%"),
});

export const generatePayoutSchema = z.object({
  storeId: z.string().uuid("Chọn cửa hàng"),
  periodStart: z.string().min(1, "Chọn ngày bắt đầu"),
  periodEnd: z.string().min(1, "Chọn ngày kết thúc"),
});
