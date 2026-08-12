"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { updateStatus } from "@/lib/repositories/order.repository";
import type { OrderStatus } from "@/lib/domain/order";

// Regular authenticated client — orders_update_store_owner RLS already
// scopes this correctly (the store owner updating an order placed at their
// own store), unlike order creation which is a cross-actor write.
export async function updateOrderStatusAction(orderId: string, status: OrderStatus) {
  const supabase = await createClient();
  await updateStatus(supabase, orderId, status);
  revalidatePath("/dashboard/orders");
}
