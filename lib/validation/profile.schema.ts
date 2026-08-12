import { z } from "zod";

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(1, "Vui lòng nhập họ tên").max(120).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+ ]{8,15}$/, "Số điện thoại không hợp lệ")
    .optional()
    .or(z.literal("")),
  avatarUrl: z.string().url().optional(),
});

export type UpdateProfileFormValues = z.infer<typeof updateProfileSchema>;
