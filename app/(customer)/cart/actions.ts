"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { checkoutSchema } from "@/lib/validation/order.schema";
import { parseOrThrow } from "@/lib/validation/parse";
import { getSnapshotsByIds } from "@/lib/repositories/combo.repository";
import { getOwnerIdById } from "@/lib/repositories/store.repository";
import { getById as getProfileById } from "@/lib/repositories/profile.repository";
import { getSummary, sweepExpiredPoints } from "@/lib/repositories/net-zero.repository";
import { resolveCheckoutDiscount } from "@/lib/repositories/group-buy.repository";
import { OrderBuilder } from "@/lib/factories/order.builder";
import * as orderRepository from "@/lib/repositories/order.repository";
import type { ComboSnapshot } from "@/lib/domain/combo";

// Read-only, regular client — combos_select_public RLS (0001) already
// permits this (price/stock/status/best_before aren't sensitive, the same
// fields are already shown on public listing pages). Lets cart-view.tsx
// warn about a stale cart item (expired, sold out, unlisted) *before* the
// customer clicks "Đặt hàng" instead of only finding out from
// OrderBuilder's rejection at actual submit time — the cart itself is
// client-only localStorage (lib/cart/cart-context.tsx), so it has no way to
// know on its own whether an item is still purchasable.
export async function getCartSnapshotsAction(comboIds: string[]): Promise<ComboSnapshot[]> {
  if (comboIds.length === 0) return [];
  const supabase = await createClient();
  return getSnapshotsByIds(supabase, comboIds);
}

// Order creation is a cross-actor write (checkout modifies the store's
// combo stock) plus money-handling fields — runs entirely on the
// service-role client, per the "payments pattern" in
// .claude/rules/database-and-schema.md. The regular client is only used to
// resolve who's currently signed in.
export async function createOrderAction(input: unknown): Promise<{ orderId: string }> {
  const parsed = parseOrThrow(checkoutSchema, input);

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập trước khi đặt hàng.");

  const admin = createAdminClient();

  // role='admin' is a "pure staff" account per explicit product decision —
  // no shopping. The primary gate is hiding the cart/checkout entry points
  // entirely for that role (site-header.tsx, add-to-cart-button.tsx's
  // isAdmin prop); this is defense-in-depth in case a stale cart or a
  // direct action call slips through.
  const profile = await getProfileById(supabase, userId);
  if (profile?.role === "admin") {
    throw new Error("Tài khoản quản trị không thể mua hàng.");
  }

  // Defense-in-depth: a store can't buy from itself — the primary gate is
  // combos/[id]/page.tsx not showing "Thêm vào giỏ hàng" for the viewer's
  // own store, this catches a cart built before that check (e.g. added,
  // then the combo's store later got linked to this account).
  const storeOwnerId = await getOwnerIdById(admin, parsed.storeId);
  if (storeOwnerId === userId) {
    throw new Error("Bạn không thể tự đặt hàng từ cửa hàng của chính mình.");
  }

  // Must complete before getSummary() below reads the balance — otherwise
  // an already-expired-but-not-yet-swept batch could still be redeemed.
  await sweepExpiredPoints(admin, userId);

  const comboIds = parsed.items.map((i) => i.comboId);
  const [snapshots, netZero, groupDiscount] = await Promise.all([
    getSnapshotsByIds(admin, comboIds),
    getSummary(admin, userId),
    // Never trust a client-supplied bulk-discount percentage — resolved
    // fresh here from the group order's own live total quantity. Returns
    // null (no discount, discountPct effectively 0) for a missing/closed/
    // expired group order, or one whose store doesn't match this cart —
    // that last check matters because a group order is only ever valid for
    // the specific store it was created for.
    parsed.groupOrderId ? resolveCheckoutDiscount(admin, parsed.groupOrderId) : Promise.resolve(null),
  ]);
  if (parsed.groupOrderId && (!groupDiscount || groupDiscount.storeId !== parsed.storeId)) {
    throw new Error("Lời mời mua chung này đã hết hạn hoặc không hợp lệ.");
  }

  const built = OrderBuilder.build(
    {
      customerId: userId,
      storeId: parsed.storeId,
      fulfillmentType: parsed.fulfillmentType,
      deliveryAddressLine: parsed.deliveryAddressLine,
      deliveryLat: parsed.deliveryLat,
      deliveryLng: parsed.deliveryLng,
      items: parsed.items,
      // Never trust the client's own idea of its points balance — same
      // rule as combo prices/stock (getSnapshotsByIds above).
      netZeroPointsToApply: parsed.netZeroPointsToApply,
      availableNetZeroPoints: netZero.pointsBalance,
      groupOrderId: parsed.groupOrderId,
      bulkDiscountPct: groupDiscount?.discountPct,
    },
    snapshots
  );

  const order = await orderRepository.create(admin, built);

  // Net Zero points fully covering the order total is treated as an
  // immediate, automatic "payment" — there's nothing left to actually pay a
  // gateway for, so there's no reason to make the customer click through a
  // symbolic VNPay/Momo screen for 0đ. Skips straight to the paid state
  // (and, for pickup orders, the QR code) the instant they land on
  // /orders/[id]. Any positive remaining total still goes through the real
  // (simulated) payment-method step on that page.
  if (order.totalAmount === 0) {
    await orderRepository.markPaid(admin, order.id, "vnpay");
  }

  return { orderId: order.id };
}
