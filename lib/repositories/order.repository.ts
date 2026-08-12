import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Order, OrderStatus, StoreMonthlyStats } from "@/lib/domain/order";
import type { BuiltOrder } from "@/lib/factories/order.builder";

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
  const { error } = await client.from("orders").update({ status }).eq("id", id);
  if (error) throw error;

  if (status === "rejected" || status === "cancelled") {
    await restoreStock(client, id);
  }
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
    .select("total_amount, fulfillment_type")
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
