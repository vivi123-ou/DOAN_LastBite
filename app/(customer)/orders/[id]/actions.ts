"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getById, markPaid } from "@/lib/repositories/order.repository";
import { create as createReview } from "@/lib/repositories/review.repository";
import { createReviewSchema } from "@/lib/validation/review.schema";
import { parseOrThrow } from "@/lib/validation/parse";
import { createMomoPayment } from "@/lib/payments/momo";

// Server Actions don't get a Request object (unlike a Route Handler), so the
// site's own origin — needed for MoMo's redirectUrl/ipnUrl, both of which
// must be absolute URLs MoMo's servers can reach — is derived from the
// incoming request's Host header instead. NEXT_PUBLIC_SITE_URL overrides
// this when set (needed once deployed behind anything that mangles Host,
// or to point ipnUrl at a stable public URL during local dev via a tunnel).
async function getSiteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}`;
}

// STAND-IN for the real VNPay/Momo IPN webhook handler (Phase 2 payment
// gateway wiring, deferred — see .claude/plans and CLAUDE.md §4). When the
// real gateway lands, this action goes away and markPaid() gets called from
// a webhook route instead — nothing else in the order flow changes, since
// this already runs through the same admin-client, payments-pattern path.
// `method` is whichever symbolic gateway tile the customer picked in
// PaymentMethodSelector — recorded on the order exactly like a real gateway
// callback would report which provider was used.
export async function simulatePaymentAction(
  orderId: string,
  method: "vnpay" | "momo"
): Promise<void> {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập trước.");

  const order = await getById(supabase, orderId);
  if (!order || order.customerId !== userId) {
    throw new Error("Không tìm thấy đơn hàng.");
  }
  if (order.paymentStatus === "success") return;

  const admin = createAdminClient();
  await markPaid(admin, orderId, method);
  revalidatePath(`/orders/${orderId}`);
}

// Real MoMo integration (see lib/payments/momo.ts) — kicks off a hosted
// MoMo checkout and returns the payUrl for the client to redirect the
// browser to. This does NOT mark the order paid — only the IPN webhook
// (app/api/payments/momo/ipn/route.ts) does that, once MoMo's servers
// confirm the transaction really succeeded. A customer closing the tab
// mid-payment just leaves the order unpaid, same as today.
export async function initiateMomoPaymentAction(orderId: string): Promise<{ payUrl: string }> {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập trước.");

  const order = await getById(supabase, orderId);
  if (!order || order.customerId !== userId) {
    throw new Error("Không tìm thấy đơn hàng.");
  }
  if (order.paymentStatus === "success") {
    throw new Error("Đơn hàng này đã được thanh toán.");
  }

  const origin = await getSiteOrigin();
  const result = await createMomoPayment({
    orderId: order.id,
    amount: order.totalAmount,
    orderInfo: `LastBite - Don hang ${order.id.slice(0, 8).toUpperCase()}`,
    redirectUrl: `${origin}/orders/${order.id}`,
    ipnUrl: `${origin}/api/payments/momo/ipn`,
  });
  return { payUrl: result.payUrl };
}

// Regular authenticated client — combo_reviews_insert_own RLS already
// scopes this to the caller's own submission (same-actor write); eligibility
// (order ownership + status === 'completed') is re-checked inside
// review.repository.ts's create(), not trusted from the form.
export async function submitReviewAction(input: unknown) {
  const parsed = parseOrThrow(createReviewSchema, input);

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập trước.");

  await createReview(supabase, userId, parsed);
  revalidatePath(`/orders/${parsed.orderId}`);
  revalidatePath("/account/reviews");
}
