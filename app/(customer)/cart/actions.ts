"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { checkoutSchema } from "@/lib/validation/order.schema";
import { getSnapshotsByIds } from "@/lib/repositories/combo.repository";
import { getOwnerIdById } from "@/lib/repositories/store.repository";
import { getSummary } from "@/lib/repositories/net-zero.repository";
import { OrderBuilder } from "@/lib/factories/order.builder";
import * as orderRepository from "@/lib/repositories/order.repository";

// Order creation is a cross-actor write (checkout modifies the store's
// combo stock) plus money-handling fields — runs entirely on the
// service-role client, per the "payments pattern" in
// .claude/rules/database-and-schema.md. The regular client is only used to
// resolve who's currently signed in.
export async function createOrderAction(input: unknown): Promise<{ orderId: string }> {
  const parsed = checkoutSchema.parse(input);

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập trước khi đặt hàng.");

  const admin = createAdminClient();

  // Defense-in-depth: a store can't buy from itself — the primary gate is
  // combos/[id]/page.tsx not showing "Thêm vào giỏ hàng" for the viewer's
  // own store, this catches a cart built before that check (e.g. added,
  // then the combo's store later got linked to this account).
  const storeOwnerId = await getOwnerIdById(admin, parsed.storeId);
  if (storeOwnerId === userId) {
    throw new Error("Bạn không thể tự đặt hàng từ cửa hàng của chính mình.");
  }

  const comboIds = parsed.items.map((i) => i.comboId);
  const [snapshots, netZero] = await Promise.all([
    getSnapshotsByIds(admin, comboIds),
    getSummary(admin, userId),
  ]);

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
    },
    snapshots
  );

  const order = await orderRepository.create(admin, built);
  return { orderId: order.id };
}
