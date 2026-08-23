"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getStoreByOwnerId } from "@/lib/repositories/store.repository";
import { createPendingPurchase } from "@/lib/repositories/subscription.repository";
import { createMomoPayment } from "@/lib/payments/momo";
import { createVnpayPaymentUrl } from "@/lib/payments/vnpay";

// Same origin/IP helpers as orders/[id]/actions.ts — duplicated rather than
// shared, since this is a small, self-contained pair of functions and the
// two call sites (order checkout, subscription purchase) are otherwise
// unrelated flows; not worth a shared util module for two functions.
async function getSiteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "127.0.0.1";
}

async function requireOwnStore() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập trước.");
  const store = await getStoreByOwnerId(supabase, userId);
  if (!store) throw new Error("Bạn cần đăng ký cửa hàng trước.");
  return store;
}

// Both actions below only create a 'pending_payment' row + build a redirect
// URL — same non-marking-paid guarantee as order checkout's
// initiateMomoPaymentAction()/initiateVnpayPaymentAction(): only the
// subscription-specific IPN webhooks
// (app/api/payments/{momo,vnpay}/subscription-ipn/route.ts) actually
// activate anything.
export async function initiateMomoSubscriptionPaymentAction(
  planId: string
): Promise<{ payUrl: string }> {
  const store = await requireOwnStore();
  const admin = createAdminClient();
  const { subscriptionId, amount, planName } = await createPendingPurchase(admin, store.id, planId);

  const origin = await getSiteOrigin();
  const result = await createMomoPayment({
    orderId: subscriptionId,
    amount,
    orderInfo: `LastBite - Goi dich vu ${planName}`,
    redirectUrl: `${origin}/dashboard/subscription`,
    ipnUrl: `${origin}/api/payments/momo/subscription-ipn`,
  });
  revalidatePath("/dashboard/subscription");
  return { payUrl: result.payUrl };
}

export async function initiateVnpaySubscriptionPaymentAction(
  planId: string
): Promise<{ payUrl: string }> {
  const store = await requireOwnStore();
  const admin = createAdminClient();
  const { subscriptionId, amount, planName } = await createPendingPurchase(admin, store.id, planId);

  const [origin, ipAddr] = await Promise.all([getSiteOrigin(), getClientIp()]);
  const { payUrl } = createVnpayPaymentUrl({
    orderId: subscriptionId,
    amount,
    ipAddr,
    returnUrl: `${origin}/dashboard/subscription`,
    orderInfo: `LastBite thanh toan goi dich vu ${planName} ${subscriptionId}`,
  });
  revalidatePath("/dashboard/subscription");
  return { payUrl };
}
