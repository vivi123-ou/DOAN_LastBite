"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getById } from "@/lib/repositories/profile.repository";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPlan, setPlanActive } from "@/lib/repositories/subscription.repository";
import { createPlanSchema } from "@/lib/validation/subscription.schema";
import { parseOrThrow } from "@/lib/validation/parse";

async function requireAdmin() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập trước.");
  const profile = await getById(supabase, userId);
  if (!profile || profile.role !== "admin") throw new Error("Bạn không có quyền truy cập trang này.");
}

export async function createPlanAction(input: unknown) {
  await requireAdmin();
  const parsed = parseOrThrow(createPlanSchema, input);
  await createPlan(createAdminClient(), parsed);
  revalidatePath("/admin/plans");
}

export async function setPlanActiveAction(planId: string, isActive: boolean) {
  await requireAdmin();
  await setPlanActive(createAdminClient(), planId, isActive);
  revalidatePath("/admin/plans");
}
