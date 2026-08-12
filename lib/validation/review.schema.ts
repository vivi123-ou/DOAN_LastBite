import { z } from "zod";

export const createReviewSchema = z
  .object({
    orderId: z.string().uuid(),
    orderItemId: z.string().uuid(),
    kind: z.enum(["review", "report"]),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    comment: z.string().trim().max(1000).optional(),
  })
  .refine((data) => data.kind !== "review" || data.rating !== undefined, {
    message: "Vui lòng chọn số sao đánh giá",
    path: ["rating"],
  })
  .refine((data) => data.kind !== "report" || (data.comment && data.comment.length > 0), {
    message: "Vui lòng mô tả vấn đề bạn gặp phải",
    path: ["comment"],
  });

export type CreateReviewFormValues = z.infer<typeof createReviewSchema>;
