"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getById, markPaid } from "@/lib/repositories/order.repository";

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
