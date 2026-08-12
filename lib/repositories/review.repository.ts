import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type {
  ComboRatingSummary,
  ComboReview,
  CreateReviewInput,
  StoreReviewStats,
} from "@/lib/domain/review";

type ReviewRow = Database["public"]["Tables"]["combo_reviews"]["Row"];

function toDomain(row: ReviewRow, comboName: string, customerName: string | null): ComboReview {
  return {
    id: row.id,
    orderId: row.order_id,
    orderItemId: row.order_item_id,
    comboId: row.combo_id,
    comboName,
    customerId: row.customer_id,
    customerName,
    storeId: row.store_id,
    kind: row.kind,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
  };
}

// combo_reviews_insert_own RLS requires customer_id = auth.uid() — same-
// actor write, regular client. Eligibility (order actually belongs to this
// customer, and is 'completed' — "mua xong sử dụng xong") is re-checked
// here defensively rather than trusted from the client, same posture as
// order.builder.ts re-checking best_before/stock at checkout.
export async function create(
  client: SupabaseClient<Database>,
  customerId: string,
  input: CreateReviewInput
): Promise<ComboReview> {
  const { data: orderItem, error: itemError } = await client
    .from("order_items")
    .select("id, order_id, combo_id")
    .eq("id", input.orderItemId)
    .maybeSingle();
  if (itemError) throw itemError;
  if (!orderItem || orderItem.order_id !== input.orderId) {
    throw new Error("Không tìm thấy sản phẩm trong đơn hàng này.");
  }

  const { data: order, error: orderError } = await client
    .from("orders")
    .select("customer_id, store_id, status")
    .eq("id", input.orderId)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order || order.customer_id !== customerId) {
    throw new Error("Bạn không thể đánh giá đơn hàng này.");
  }
  if (order.status !== "completed") {
    throw new Error("Chỉ có thể đánh giá sau khi đơn hàng đã hoàn tất.");
  }

  const { data: row, error } = await client
    .from("combo_reviews")
    .insert({
      order_id: input.orderId,
      order_item_id: input.orderItemId,
      combo_id: orderItem.combo_id,
      customer_id: customerId,
      store_id: order.store_id,
      kind: input.kind,
      rating: input.kind === "review" ? (input.rating ?? null) : null,
      comment: input.comment ?? null,
    })
    .select("*")
    .single();
  if (error) {
    // Postgres unique_violation on (order_item_id, customer_id).
    if (error.code === "23505") {
      throw new Error("Bạn đã đánh giá sản phẩm này rồi.");
    }
    throw error;
  }

  const { data: combo } = await client.from("combos").select("name").eq("id", row.combo_id).maybeSingle();
  return toDomain(row, combo?.name ?? "", null);
}

// Backs the order detail page — which items already have a review/report
// from this customer, so the form doesn't render again for them.
// combo_reviews_select_own RLS already scopes this correctly.
export async function listForOrder(
  client: SupabaseClient<Database>,
  orderId: string
): Promise<ComboReview[]> {
  const { data: rows, error } = await client.from("combo_reviews").select("*").eq("order_id", orderId);
  if (error) throw error;
  return rows.map((row) => toDomain(row, "", null));
}

// combo_reviews_select_own RLS already scopes this to the caller's own
// submissions — regular client. Backs the account "Đánh giá đơn hàng" page.
export async function listForCustomer(
  client: SupabaseClient<Database>,
  customerId: string
): Promise<ComboReview[]> {
  const { data: rows, error } = await client
    .from("combo_reviews")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (rows.length === 0) return [];

  const comboIds = [...new Set(rows.map((r) => r.combo_id))];
  const { data: combos, error: combosError } = await client
    .from("combos")
    .select("id, name")
    .in("id", comboIds);
  if (combosError) throw combosError;
  const nameByCombo = new Map(combos.map((c) => [c.id, c.name]));

  return rows.map((row) => toDomain(row, nameByCombo.get(row.combo_id) ?? "", null));
}

// combo_reviews_select_public RLS already scopes this to kind='review' for
// any caller (reports stay private) — regular client. Backs the combo
// detail page's review list.
export async function listPublicForCombo(
  client: SupabaseClient<Database>,
  comboId: string,
  limit = 20
): Promise<ComboReview[]> {
  const { data: rows, error } = await client
    .from("combo_reviews")
    .select("*")
    .eq("combo_id", comboId)
    .eq("kind", "review")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (rows.length === 0) return [];

  const customerIds = [...new Set(rows.map((r) => r.customer_id))];
  const { data: profiles } = await client.from("profiles").select("id, full_name").in("id", customerIds);
  const nameByCustomer = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return rows.map((row) => toDomain(row, "", nameByCustomer.get(row.customer_id) ?? null));
}

export async function getComboRatingSummary(
  client: SupabaseClient<Database>,
  comboId: string
): Promise<{ averageRating: number; reviewCount: number }> {
  const { data: rows, error } = await client
    .from("combo_reviews")
    .select("rating")
    .eq("combo_id", comboId)
    .eq("kind", "review");
  if (error) throw error;
  if (rows.length === 0) return { averageRating: 0, reviewCount: 0 };

  const sum = rows.reduce((acc, r) => acc + (r.rating ?? 0), 0);
  return { averageRating: sum / rows.length, reviewCount: rows.length };
}

// combo_reviews_select_store_owner RLS already scopes this to the caller's
// own store (reviews *and* reports both — a store owner needs to see
// reports, that's the point) — regular client. Backs the store dashboard's
// "Đánh giá sản phẩm" analytics block.
export async function getStoreStats(
  client: SupabaseClient<Database>,
  storeId: string
): Promise<StoreReviewStats> {
  const { data: rows, error } = await client
    .from("combo_reviews")
    .select("combo_id, kind, rating")
    .eq("store_id", storeId);
  if (error) throw error;

  const reportCount = rows.filter((r) => r.kind === "report").length;
  const reviewRows = rows.filter((r) => r.kind === "review" && r.rating !== null);
  if (reviewRows.length === 0) return { topRated: [], lowestRated: [], reportCount };

  const comboIds = [...new Set(reviewRows.map((r) => r.combo_id))];
  const { data: combos } = await client.from("combos").select("id, name").in("id", comboIds);
  const nameByCombo = new Map((combos ?? []).map((c) => [c.id, c.name]));

  const byCombo = new Map<string, { sum: number; count: number }>();
  for (const row of reviewRows) {
    const entry = byCombo.get(row.combo_id) ?? { sum: 0, count: 0 };
    entry.sum += row.rating ?? 0;
    entry.count += 1;
    byCombo.set(row.combo_id, entry);
  }

  const summaries: ComboRatingSummary[] = Array.from(byCombo.entries()).map(([comboId, { sum, count }]) => ({
    comboId,
    comboName: nameByCombo.get(comboId) ?? "",
    averageRating: sum / count,
    reviewCount: count,
  }));

  const sorted = [...summaries].sort((a, b) => b.averageRating - a.averageRating);
  return {
    topRated: sorted.slice(0, 3),
    lowestRated: sorted.slice(-3).reverse(),
    reportCount,
  };
}
