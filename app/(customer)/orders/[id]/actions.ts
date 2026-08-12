"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getById, markPaid } from "@/lib/repositories/order.repository";
import { create as createReview } from "@/lib/repositories/review.repository";
import { createReviewSchema } from "@/lib/validation/review.schema";

// STAND-IN for the real VNPay/Momo IPN webhook handler (Phase 2 payment
// gateway wiring, deferred — see .claude/plans and CLAUDE.md §4). When the
// real gateway lands, this action goes away and markPaid() gets called from
// a webhook route instead — nothing else in the order flow changes, since
// this already runs through the same admin-client, payments-pattern path.
export async function simulatePaymentAction(orderId: string): Promise<void> {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập trước.");

  const order = await getById(supabase, orderId);
  if (!order || order.customerId !== userId) {
    throw new Error("Không tìm thấy đơn hàng.");
  }
  if (order.paymentStatus === "success") return;

  const admin = createAdminClient();
  await markPaid(admin, orderId, "vnpay");
  revalidatePath(`/orders/${orderId}`);
}

// Regular authenticated client — combo_reviews_insert_own RLS already
// scopes this to the caller's own submission (same-actor write); eligibility
// (order ownership + status === 'completed') is re-checked inside
// review.repository.ts's create(), not trusted from the form.
export async function submitReviewAction(input: unknown) {
  const parsed = createReviewSchema.parse(input);

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập trước.");

  await createReview(supabase, userId, parsed);
  revalidatePath(`/orders/${parsed.orderId}`);
  revalidatePath("/account/reviews");
}
