"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getStoreByOwnerId } from "@/lib/repositories/store.repository";
import { createPendingBooking } from "@/lib/repositories/ad.repository";
import { createMomoPayment } from "@/lib/payments/momo";
import { createVnpayPaymentUrl } from "@/lib/payments/vnpay";
import { parseOrThrow } from "@/lib/validation/parse";
import { bookAdSchema } from "@/lib/validation/ad.schema";

// Same origin/IP helpers duplicated in every payment-initiating action file
// in this app (orders/[id]/actions.ts, dashboard/subscription/actions.ts) —
// small enough, and the call sites are unrelated flows, not worth a shared
// util module for two functions.
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

export interface BookAdInput {
  placementTypeId: string;
  comboId?: string;
  radiusM?: number;
  bannerImageUrl?: string;
  linkUrl?: string;
}

// Both actions below only create a 'pending_payment' ad_bookings row + build
// a redirect URL — same non-marking-paid guarantee as every other payment-
// initiating action in this app. Only the ad-specific IPN webhooks
// (app/api/payments/{momo,vnpay}/ad-ipn/route.ts) actually activate it.
export async function initiateMomoAdPaymentAction(rawInput: BookAdInput): Promise<{ payUrl: string }> {
  const input = parseOrThrow(bookAdSchema, rawInput);
  const store = await requireOwnStore();
  const admin = createAdminClient();
  const { bookingId, amount, placementName } = await createPendingBooking(admin, store.id, input.placementTypeId, {
    comboId: input.comboId,
    radiusM: input.radiusM,
    bannerImageUrl: input.bannerImageUrl,
    linkUrl: input.linkUrl,
  });

  const origin = await getSiteOrigin();
  const result = await createMomoPayment({
    orderId: bookingId,
    amount,
    orderInfo: `LastBite - Quang cao ${placementName}`,
    redirectUrl: `${origin}/dashboard/ads`,
    ipnUrl: `${origin}/api/payments/momo/ad-ipn`,
  });
  revalidatePath("/dashboard/ads");
  return { payUrl: result.payUrl };
}

export async function initiateVnpayAdPaymentAction(rawInput: BookAdInput): Promise<{ payUrl: string }> {
  const input = parseOrThrow(bookAdSchema, rawInput);
  const store = await requireOwnStore();
  const admin = createAdminClient();
  const { bookingId, amount, placementName } = await createPendingBooking(admin, store.id, input.placementTypeId, {
    comboId: input.comboId,
    radiusM: input.radiusM,
    bannerImageUrl: input.bannerImageUrl,
    linkUrl: input.linkUrl,
  });

  const [origin, ipAddr] = await Promise.all([getSiteOrigin(), getClientIp()]);
  const payUrl = createVnpayPaymentUrl({
    orderId: bookingId,
    amount,
    ipAddr,
    returnUrl: `${origin}/dashboard/ads`,
    orderInfo: `LastBite thanh toan quang cao ${placementName} ${bookingId}`,
  });
  revalidatePath("/dashboard/ads");
  return { payUrl };
}
