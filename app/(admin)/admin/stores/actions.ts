"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getById } from "@/lib/repositories/profile.repository";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  updateStoreVerification,
  updateStoreActive,
  bulkSetStoreVerification,
} from "@/lib/repositories/admin.repository";
import { grantFreeTrialIfEligible } from "@/lib/repositories/subscription.repository";
import type { Database } from "@/types/database.types";

type VerificationStatus = Database["public"]["Tables"]["stores"]["Row"]["verification_status"];

// Re-checked here, not just trusted from the layout guard — a Server Action
// can be invoked directly (not only through the page that renders its
// trigger button), so it needs its own authorization check, same posture
// as every other cross-actor server action in this codebase.
async function requireAdmin() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập trước.");
  const profile = await getById(supabase, userId);
  if (!profile || profile.role !== "admin") throw new Error("Bạn không có quyền truy cập trang này.");
}

export async function setStoreVerificationAction(storeId: string, status: VerificationStatus) {
  await requireAdmin();
  const admin = createAdminClient();
  await updateStoreVerification(admin, storeId, status);
  // Best-effort, and only on the transition that actually matters — a
  // free-trial-grant hiccup should never block the approval action itself.
  if (status === "verified") {
    await grantFreeTrialIfEligible(admin, storeId).catch(() => {});
  }
  revalidatePath("/admin/stores");
}

export async function setStoreActiveAction(storeId: string, isActive: boolean) {
  await requireAdmin();
  await updateStoreActive(createAdminClient(), storeId, isActive);
  revalidatePath("/admin/stores");
}

export async function bulkSetStoreVerificationAction(storeIds: string[], status: VerificationStatus) {
  await requireAdmin();
  const admin = createAdminClient();
  await bulkSetStoreVerification(admin, storeIds, status);
  if (status === "verified") {
    await Promise.all(storeIds.map((id) => grantFreeTrialIfEligible(admin, id).catch(() => {})));
  }
  revalidatePath("/admin/stores");
}
