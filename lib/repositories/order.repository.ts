import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Order, OrderStatus, OrderStatusEvent, StoreMonthlyStats } from "@/lib/domain/order";
import type { BuiltOrder } from "@/lib/factories/order.builder";
import { adjustBalance, recordOrderImpact } from "@/lib/repositories/net-zero.repository";
import { create as createNotification } from "@/lib/repositories/notification.repository";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

async function hydrate(
  client: SupabaseClient<Database>,
  row: OrderRow,
  storeName: string
): Promise<Order> {
  const [{ data: itemRows, error: itemsError }, { data: profile }] = await Promise.all([
    client.from("order_items").select("*").eq("order_id", row.id),
    client.from("profiles").select("full_name, phone").eq("id", row.customer_id).maybeSingle(),
  ]);
  if (itemsError) throw itemsError;

  const comboIds = itemRows.map((i) => i.combo_id);
  const comboNameById = new Map<string, string>();
  if (comboIds.length > 0) {
    const { data: comboRows, error: comboError } = await client
      .from("combos")
      .select("id, name")
      .in("id", comboIds);
    if (comboError) throw comboError;
    comboRows.forEach((c) => comboNameById.set(c.id, c.name));
  }

  let deliveryAddressLine: string | null = null;
  if (row.delivery_address_id) {
    const { data: address } = await client
      .from("addresses")
      .select("address_line")
      .eq("id", row.delivery_address_id)
      .maybeSingle();
    deliveryAddressLine = address?.address_line ?? null;
  }

  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: profile?.full_name ?? null,
    customerPhone: profile?.phone ?? null,
    storeId: row.store_id,
    storeName,
    status: row.status,
    fulfillmentType: row.fulfillment_type,
    deliveryAddressLine,
    subtotal: row.subtotal,
    discountAmount: row.discount_amount,
    bulkDiscountPct: row.bulk_discount_pct,
    groupOrderId: row.group_order_id,
    netZeroPointsUsed: row.net_zero_points_used,
    totalAmount: row.total_amount,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    qrCodeToken: row.qr_code_token,
    createdAt: row.created_at,
    items: itemRows.map((i) => ({
      id: i.id,
      comboId: i.combo_id,
      comboName: comboNameById.get(i.combo_id) ?? "",
      quantity: i.quantity,
      unitPriceAtPurchase: i.unit_price_at_purchase,
      subtotal: i.subtotal,
    })),
  };
}

// Order creation is a cross-actor write (a customer's checkout modifies the
// store's combo stock) plus money-handling fields — per
// .claude/rules/database-and-schema.md's "payments pattern," this runs with
// the service-role client (see app/(customer)/cart/actions.ts), not the
// customer's own session. order_items has no customer-facing INSERT policy
// and combos has no customer-facing UPDATE policy for exactly this reason.
export async function create(adminClient: SupabaseClient<Database>, built: BuiltOrder): Promise<Order> {
  let deliveryAddressId: string | null = null;
  if (built.delivery) {
    const { data: address, error: addressError } = await adminClient
      .from("addresses")
      .insert({
        user_id: built.order.customer_id,
        address_line: built.delivery.addressLine,
        geog: `SRID=4326;POINT(${built.delivery.lng} ${built.delivery.lat})`,
        lat: built.delivery.lat,
        lng: built.delivery.lng,
      })
      .select("id")
      .single();
    if (addressError) throw addressError;
    deliveryAddressId = address.id;
  }

  const { data: order, error } = await adminClient
    .from("orders")
    .insert({ ...built.order, delivery_address_id: deliveryAddressId, status: "pending", payment_status: "unpaid" })
    .select("*")
    .single();
  if (error) throw error;

  // First entry in the status timeline (order-status-timeline.tsx) — admin
  // client, same as the rest of this cross-actor checkout write.
  const { error: historyError } = await adminClient
    .from("order_status_history")
    .insert({ order_id: order.id, status: "pending" });
  if (historyError) throw historyError;

  const { error: itemsError } = await adminClient
    .from("order_items")
    .insert(built.items.map((item) => ({
      order_id: order.id,
      combo_id: item.combo_id,
      quantity: item.quantity,
      unit_price_at_purchase: item.unit_price_at_purchase,
      subtotal: item.subtotal,
    })));
  if (itemsError) throw itemsError;

  // Sequential per-item stock decrement using the build-time snapshot — see
  // BuiltOrder.items[].remainingStockBeforeOrder for the accepted
  // race-condition tradeoff.
  for (const item of built.items) {
    const { error: stockError } = await adminClient
      .from("combos")
      .update({ remaining_stock: item.remainingStockBeforeOrder - item.quantity })
      .eq("id", item.combo_id);
    if (stockError) throw stockError;
  }

  // Deduct redeemed Net Zero points immediately at order creation, not at
  // payment success — mirrors the stock decrement above (reserved as soon
  // as the order exists, refunded via restoreStock()'s same
  // rejected/cancelled trigger below if it doesn't go through).
  if (built.order.net_zero_points_used > 0) {
    await adjustBalance(adminClient, built.order.customer_id, -built.order.net_zero_points_used);
  }

  const { data: store } = await adminClient
    .from("stores")
    .select("name")
    .eq("id", order.store_id)
    .single();

  return hydrate(adminClient, order, store?.name ?? "");
}

export async function listForCustomer(
  client: SupabaseClient<Database>,
  customerId: string
): Promise<Order[]> {
  const { data: rows, error } = await client
    .from("orders")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (rows.length === 0) return [];

  const storeIds = [...new Set(rows.map((r) => r.store_id))];
  const { data: stores, error: storesError } = await client
    .from("stores")
    .select("id, name")
    .in("id", storeIds);
  if (storesError) throw storesError;
  const storeNameById = new Map(stores.map((s) => [s.id, s.name]));

  return Promise.all(rows.map((row) => hydrate(client, row, storeNameById.get(row.store_id) ?? "")));
}

export async function listForStore(
  client: SupabaseClient<Database>,
  storeId: string,
  status?: OrderStatus
): Promise<Order[]> {
  let query = client.from("orders").select("*").eq("store_id", storeId);
  if (status) query = query.eq("status", status);
  const { data: rows, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  if (rows.length === 0) return [];

  const { data: store } = await client.from("stores").select("name").eq("id", storeId).single();

  return Promise.all(rows.map((row) => hydrate(client, row, store?.name ?? "")));
}

export async function getById(client: SupabaseClient<Database>, id: string): Promise<Order | null> {
  const { data: row, error } = await client.from("orders").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const { data: store } = await client.from("stores").select("name").eq("id", row.store_id).single();
  return hydrate(client, row, store?.name ?? "");
}

// Store owner accept/reject/advance — uses the regular authenticated client
// since orders_update_store_owner RLS already scopes this correctly (unlike
// create(), this isn't a cross-actor write: the store owner updating their
// own incoming order is exactly what that policy is for).
export async function updateStatus(
  client: SupabaseClient<Database>,
  id: string,
  status: OrderStatus
): Promise<void> {
  // Defense-in-depth, same spirit as re-validating stock/price at checkout:
  // nothing on the client stops a store owner from clicking through every
  // "next step" button without the customer ever having actually paid
  // (order-status-actions.tsx has no payment awareness at all) — that left
  // an order sitting as 'completed' with payment_status still 'unpaid',
  // which then confusingly still showed the VNPay/Momo picker on an
  // already-"finished" order. A completed order must have been paid.
  if (status === "completed") {
    const { data: existing, error: fetchError } = await client
      .from("orders")
      .select("payment_status")
      .eq("id", id)
      .single();
    if (fetchError) throw fetchError;
    if (existing.payment_status !== "success") {
      throw new Error("Đơn hàng chưa thanh toán — không thể đánh dấu hoàn tất.");
    }
  }

  const { error } = await client.from("orders").update({ status }).eq("id", id);
  if (error) throw error;

  // order_status_history_insert_store_owner RLS (0023) already scopes this
  // to the caller's own store's orders — same regular client, no admin
  // needed, matching the update above it.
  const { error: historyError } = await client
    .from("order_status_history")
    .insert({ order_id: id, status });
  if (historyError) throw historyError;

  if (status === "rejected" || status === "cancelled") {
    await restoreStock(client, id);
  }
}

// Newest first — matches the Shopee/Fahasa-style timeline reference this
// UI is modeled on (order-status-timeline.tsx).
export async function listStatusHistory(
  client: SupabaseClient<Database>,
  orderId: string
): Promise<OrderStatusEvent[]> {
  const { data, error } = await client
    .from("order_status_history")
    .select("status, changed_at")
    .eq("order_id", orderId)
    .order("changed_at", { ascending: false });
  if (error) throw error;
  return data.map((row) => ({ status: row.status, changedAt: row.changed_at }));
}

// Batched variant for a whole order list (dashboard/orders/page.tsx) — one
// query for every order on the page instead of one per card.
export async function listStatusHistoryForOrders(
  client: SupabaseClient<Database>,
  orderIds: string[]
): Promise<Map<string, OrderStatusEvent[]>> {
  if (orderIds.length === 0) return new Map();

  const { data, error } = await client
    .from("order_status_history")
    .select("order_id, status, changed_at")
    .in("order_id", orderIds)
    .order("changed_at", { ascending: false });
  if (error) throw error;

  const byOrder = new Map<string, OrderStatusEvent[]>();
  for (const row of data) {
    const existing = byOrder.get(row.order_id) ?? [];
    existing.push({ status: row.status, changedAt: row.changed_at });
    byOrder.set(row.order_id, existing);
  }
  return byOrder;
}

async function restoreStock(client: SupabaseClient<Database>, orderId: string): Promise<void> {
  const { data: items, error } = await client
    .from("order_items")
    .select("combo_id, quantity")
    .eq("order_id", orderId);
  if (error) throw error;

  for (const item of items) {
    const { data: combo } = await client
      .from("combos")
      .select("remaining_stock")
      .eq("id", item.combo_id)
      .maybeSingle();
    if (!combo) continue;
    await client
      .from("combos")
      .update({ remaining_stock: combo.remaining_stock + item.quantity })
      .eq("id", item.combo_id);
  }
}

// Stand-in for the real VNPay/Momo IPN webhook handler — see
// app/(customer)/orders/[id]/actions.ts. Admin client: payments has zero
// client-facing policies (.claude/rules/database-and-schema.md).
export async function markPaid(
  adminClient: SupabaseClient<Database>,
  orderId: string,
  method: "vnpay" | "momo"
): Promise<void> {
  const { data: order, error: orderError } = await adminClient
    .from("orders")
    .select("customer_id, total_amount, fulfillment_type")
    .eq("id", orderId)
    .single();
  if (orderError) throw orderError;

  const { error: paymentError } = await adminClient.from("payments").insert({
    order_id: orderId,
    provider: method,
    provider_txn_id: `SIMULATED-${Date.now()}`,
    amount: order.total_amount,
    status: "success",
    raw_response: { simulated: true },
    ipn_received_at: new Date().toISOString(),
  });
  if (paymentError) throw paymentError;

  const { error: updateError } = await adminClient
    .from("orders")
    .update({
      payment_status: "success",
      payment_method: method,
      qr_code_token: order.fulfillment_type === "pickup" ? crypto.randomUUID() : null,
    })
    .eq("id", orderId);
  if (updateError) throw updateError;

  // Best-effort: a Net Zero ledger/points hiccup shouldn't fail the
  // payment itself — the order is genuinely paid regardless.
  const impact = await recordOrderImpact(
    adminClient,
    orderId,
    order.customer_id,
    order.total_amount
  ).catch(() => null);

  // Surface what was actually credited — previously this ran silently, so
  // a customer had no way to know points/CO2 were even earned, or how
  // much, short of digging into /account/net-zero themselves.
  if (impact && (impact.pointsEarned > 0 || impact.co2SavedKg > 0)) {
    const parts: string[] = [];
    if (impact.pointsEarned > 0) parts.push(`+${impact.pointsEarned} điểm Net Zero`);
    if (impact.co2SavedKg > 0) parts.push(`giảm ${impact.co2SavedKg.toFixed(1)}kg CO2`);
    await createNotification(adminClient, {
      userId: order.customer_id,
      type: "net_zero_earned",
      title: "Bạn vừa tích luỹ Net Zero!",
      body: `Đơn hàng này giúp bạn ${parts.join(" và ")}. Xem chi tiết ở trang Điểm Net Zero.`,
      payload: { orderId },
    }).catch(() => {});
  }
}

export async function getStoreMonthlyStats(
  client: SupabaseClient<Database>,
  storeId: string
): Promise<StoreMonthlyStats> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data, error } = await client
    .from("orders")
    .select("status, total_amount")
    .eq("store_id", storeId)
    .gte("created_at", startOfMonth.toISOString());
  if (error) throw error;

  const completed = data.filter((o) => o.status === "completed");
  return {
    orderCount: data.length,
    completedOrderCount: completed.length,
    revenue: completed.reduce((sum, o) => sum + o.total_amount, 0),
  };
}

// Feeds the homepage "Có thể bạn thích" section — categories the customer
// has actually ordered from before, ranked by frequency. Plain JS
// aggregation over a customer's own order history (expected to stay small)
// rather than a dedicated SQL aggregate RPC — not worth a new migration for
// this scope. See lib/domain/category.ts for what a category id maps to.
export async function getTopPurchasedCategoryIds(
  client: SupabaseClient<Database>,
  customerId: string,
  limit = 2
): Promise<string[]> {
  const { data: orders, error: ordersError } = await client
    .from("orders")
    .select("id")
    .eq("customer_id", customerId);
  if (ordersError) throw ordersError;
  if (orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);
  const { data: items, error: itemsError } = await client
    .from("order_items")
    .select("combo_id")
    .in("order_id", orderIds);
  if (itemsError) throw itemsError;
  if (items.length === 0) return [];

  const comboIds = [...new Set(items.map((i) => i.combo_id))];
  const { data: combos, error: combosError } = await client
    .from("combos")
    .select("id, category_id")
    .in("id", comboIds);
  if (combosError) throw combosError;

  const categoryIdByCombo = new Map(combos.map((c) => [c.id, c.category_id]));
  const counts = new Map<string, number>();
  for (const item of items) {
    const categoryId = categoryIdByCombo.get(item.combo_id);
    if (!categoryId) continue;
    counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([categoryId]) => categoryId);
}
