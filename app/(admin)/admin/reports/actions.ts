"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getById } from "@/lib/repositories/profile.repository";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveReport } from "@/lib/repositories/admin.repository";

async function requireAdmin() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập trước.");
  const profile = await getById(supabase, userId);
  if (!profile || profile.role !== "admin") throw new Error("Bạn không có quyền truy cập trang này.");
}

export async function resolveReportAction(reportId: string, adminNote?: string) {
  await requireAdmin();
  await resolveReport(createAdminClient(), reportId, adminNote);
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
}
