"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getById } from "@/lib/repositories/profile.repository";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePayout, markPayoutPaid } from "@/lib/repositories/commission.repository";
import { generatePayoutSchema } from "@/lib/validation/commission.schema";
import { parseOrThrow } from "@/lib/validation/parse";

async function requireAdmin() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập trước.");
  const profile = await getById(supabase, userId);
  if (!profile || profile.role !== "admin") throw new Error("Bạn không có quyền truy cập trang này.");
}

export async function generatePayoutAction(input: unknown) {
  await requireAdmin();
  const parsed = parseOrThrow(generatePayoutSchema, input);
  // The date-range picker is inclusive of both ends; the underlying query
  // is exclusive-upper-bound, same "+1 day" adjustment as the commission
  // report page.
  const periodEndExclusive = new Date(new Date(parsed.periodEnd).getTime() + 86_400_000)
    .toISOString()
    .slice(0, 10);
  await generatePayout(createAdminClient(), parsed.storeId, parsed.periodStart, periodEndExclusive);
  revalidatePath("/admin/payouts");
}

export async function markPayoutPaidAction(payoutId: string, adminNote?: string) {
  await requireAdmin();
  await markPayoutPaid(createAdminClient(), payoutId, adminNote);
  revalidatePath("/admin/payouts");
}
