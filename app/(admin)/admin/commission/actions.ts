"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getById } from "@/lib/repositories/profile.repository";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateCommissionRate } from "@/lib/repositories/commission.repository";
import { updateCommissionRateSchema } from "@/lib/validation/commission.schema";
import { parseOrThrow } from "@/lib/validation/parse";

// requireAdmin() duplicated per admin action file rather than shared — same
// established small-duplication preference already used for
// admin/plans/actions.ts, admin/stores/actions.ts, etc.
async function requireAdmin() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập trước.");
  const profile = await getById(supabase, userId);
  if (!profile || profile.role !== "admin") throw new Error("Bạn không có quyền truy cập trang này.");
}

export async function updateCommissionRateAction(input: unknown) {
  await requireAdmin();
  const parsed = parseOrThrow(updateCommissionRateSchema, input);
  await updateCommissionRate(createAdminClient(), parsed.commissionPct);
  revalidatePath("/admin/commission");
  revalidatePath("/dashboard/revenue");
}
