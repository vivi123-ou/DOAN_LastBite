"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getById } from "@/lib/repositories/order.repository";
import { create as createReview } from "@/lib/repositories/review.repository";
import { createReviewSchema } from "@/lib/validation/review.schema";
import { parseOrThrow } from "@/lib/validation/parse";
import { createMomoPayment } from "@/lib/payments/momo";
import { createVnpayPaymentUrl } from "@/lib/payments/vnpay";

// Server Actions don't get a Request object (unlike a Route Handler), so the
// site's own origin — needed for the gateways' redirectUrl/returnUrl/ipnUrl,
// all of which must be absolute URLs the gateway's servers can reach — is
// derived from the incoming request's Host header instead. NEXT_PUBLIC_SITE_URL
// overrides this when set (needed once deployed behind anything that mangles
// Host, or to point ipnUrl at a stable public URL during local dev via a tunnel).
async function getSiteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}`;
}

// Best-effort real client IP, needed by VNPay's vnp_IpAddr field — Server
// Actions have no Request object to read this from directly either.
// x-forwarded-for can carry a comma-separated chain (client, proxy1, proxy2);
// the first entry is the original client. Sandbox testing is lenient about
// this being exact, so a localhost fallback is fine.
async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "127.0.0.1";
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

// Real VNPay integration (see lib/payments/vnpay.ts) — unlike MoMo, there's
// no separate "create payment" call to await here: the signed URL itself
// *is* the redirect target, VNPay's own server builds the actual checkout
// page when the browser lands on it. Same non-marking-paid guarantee as
// MoMo's version — only the IPN webhook (app/api/payments/vnpay/ipn/route.ts)
// actually confirms the transaction.
export async function initiateVnpayPaymentAction(orderId: string): Promise<{ payUrl: string }> {
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

  const [origin, ipAddr] = await Promise.all([getSiteOrigin(), getClientIp()]);
  const payUrl = createVnpayPaymentUrl({
    orderId: order.id,
    amount: order.totalAmount,
    ipAddr,
    returnUrl: `${origin}/orders/${order.id}`,
  });
  return { payUrl };
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
