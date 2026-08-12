"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getById, updateStatus } from "@/lib/repositories/order.repository";
import { create as createNotification } from "@/lib/repositories/notification.repository";
import type { OrderStatus } from "@/lib/domain/order";

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Chờ xác nhận",
  accepted: "Đã xác nhận",
  rejected: "Đã từ chối",
  preparing: "Đang chuẩn bị",
  ready: "Sẵn sàng",
  completed: "Hoàn tất",
  cancelled: "Đã huỷ",
};

// Regular authenticated client — orders_update_store_owner RLS already
// scopes this correctly (the store owner updating an order placed at their
// own store), unlike order creation which is a cross-actor write.
export async function updateOrderStatusAction(orderId: string, status: OrderStatus) {
  const supabase = await createClient();
  await updateStatus(supabase, orderId, status);
  revalidatePath("/dashboard/orders");

  // Notifying the *customer* about their order is itself a cross-actor
  // write (notifications has zero client-facing INSERT policy, same as
  // `payments` — see notification.repository.ts), so this step specifically
  // needs the service-role client even though updateStatus() above didn't.
  const order = await getById(supabase, orderId);
  if (order) {
    const admin = createAdminClient();
    await createNotification(admin, {
      userId: order.customerId,
      type: "order_status",
      title: `Đơn hàng tại ${order.storeName}: ${STATUS_LABEL[status]}`,
      body:
        status === "ready"
          ? "Đơn hàng của bạn đã sẵn sàng, đến lấy khi tiện nhé!"
          : status === "completed"
            ? "Cảm ơn bạn đã ủng hộ LastBite!"
            : undefined,
      payload: { orderId },
    }).catch(() => {
      // Best-effort — a failed notification insert shouldn't roll back or
      // fail the status update itself.
    });
  }
}
