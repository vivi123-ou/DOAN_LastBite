import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type {
  CommissionConfig,
  StoreCommissionReportRow,
  StorePayout,
  PayoutStatus,
} from "@/lib/domain/commission";

// Config is a genuinely public, same-actor-safe read (any signed-in store
// owner should be able to see the rate they're charged — same transparency
// spirit as bulk_discount_tiers being a plain readable table) — regular
// client. Every write in this file, and every read that spans stores other
// than the caller's own (the report, the payout list), uses the service-role
// admin client — store_payouts/commission_config follow the exact `payments`
// pattern (.claude/rules/database-and-schema.md): no client write policy
// anywhere, only server code with the service-role key.

export async function getCommissionConfig(
  client: SupabaseClient<Database>
): Promise<CommissionConfig> {
  const { data, error } = await client
    .from("commission_config")
    .select("commission_pct, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  // The seed row (0028) always exists — a null here would mean the
  // migration hasn't been applied yet, in which case the query itself
  // already would have thrown above.
  return { commissionPct: data?.commission_pct ?? 8, updatedAt: data?.updated_at ?? new Date().toISOString() };
}

export async function updateCommissionRate(
  admin: SupabaseClient<Database>,
  commissionPct: number
): Promise<void> {
  const { data: existing, error: fetchError } = await admin
    .from("commission_config")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (fetchError) throw fetchError;

  if (!existing) {
    const { error } = await admin.from("commission_config").insert({ commission_pct: commissionPct });
    if (error) throw error;
    return;
  }

  const { error } = await admin
    .from("commission_config")
    .update({ commission_pct: commissionPct, updated_at: new Date().toISOString() })
    .eq("id", existing.id);
  if (error) throw error;
}

// Live commission report for a date range — pure computation over the
// already-existing `orders` table (completed orders only, same "gross
// revenue" definition getOverviewStats()/getStoreMonthlyStats() already
// use), grouped per store in JS. Same small-aggregation-over-narrow-query
// preference already established elsewhere in this app
// (getTopPurchasedCategoryIds(), listStoreSubscriptionsForAdmin()) rather
// than a dedicated SQL aggregate RPC — no new table needed, nothing is
// persisted by this function (see generatePayout() below for the one that
// actually records a snapshot).
export async function computeCommissionReport(
  admin: SupabaseClient<Database>,
  periodStart: string,
  periodEndExclusive: string
): Promise<StoreCommissionReportRow[]> {
  const [{ commissionPct }, { data: orders, error }] = await Promise.all([
    getCommissionConfig(admin),
    admin
      .from("orders")
      .select("store_id, total_amount")
      .eq("status", "completed")
      .gte("created_at", periodStart)
      .lt("created_at", periodEndExclusive),
  ]);
  if (error) throw error;
  if (orders.length === 0) return [];

  const byStore = new Map<string, { orderCount: number; grossRevenue: number }>();
  for (const o of orders) {
    const entry = byStore.get(o.store_id) ?? { orderCount: 0, grossRevenue: 0 };
    entry.orderCount += 1;
    entry.grossRevenue += o.total_amount;
    byStore.set(o.store_id, entry);
  }

  const storeIds = [...byStore.keys()];
  const { data: stores, error: storesError } = await admin
    .from("stores")
    .select("id, name")
    .in("id", storeIds);
  if (storesError) throw storesError;
  const storeNameById = new Map(stores.map((s) => [s.id, s.name]));

  return storeIds
    .map((storeId) => {
      const { orderCount, grossRevenue } = byStore.get(storeId)!;
      const commissionAmount = Math.round((grossRevenue * commissionPct) / 100);
      return {
        storeId,
        storeName: storeNameById.get(storeId) ?? "",
        orderCount,
        grossRevenue,
        commissionAmount,
        netPayoutAmount: grossRevenue - commissionAmount,
      };
    })
    .sort((a, b) => b.grossRevenue - a.grossRevenue);
}

function mapPayout(
  row: {
    id: string;
    store_id: string;
    period_start: string;
    period_end: string;
    order_count: number;
    gross_revenue: number;
    commission_pct: number;
    commission_amount: number;
    net_payout_amount: number;
    status: "pending" | "paid";
    paid_at: string | null;
    admin_note: string | null;
    created_at: string;
  },
  storeName: string
): StorePayout {
  return {
    id: row.id,
    storeId: row.store_id,
    storeName,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    orderCount: row.order_count,
    grossRevenue: row.gross_revenue,
    commissionPct: row.commission_pct,
    commissionAmount: row.commission_amount,
    netPayoutAmount: row.net_payout_amount,
    status: row.status,
    paidAt: row.paid_at,
    adminNote: row.admin_note,
    createdAt: row.created_at,
  };
}

export interface CommissionEstimate {
  orderCount: number;
  grossRevenue: number;
  commissionPct: number;
  commissionAmount: number;
  netPayoutAmount: number;
}

// Shared computation behind both generatePayout() (admin, persists a
// snapshot) and the store's own live "ước tính" on /dashboard/revenue
// (regular client — orders_select_store_owner RLS, 0001, already scopes a
// store owner to their own store's orders, so this is a genuinely
// same-actor-safe read, no admin client needed there). Never trusts a
// cached/client-supplied total — recomputed fresh from completed orders in
// the exact range every time, same "recompute, don't trust" posture as
// checkout pricing.
export async function computeStoreCommissionEstimate(
  client: SupabaseClient<Database>,
  storeId: string,
  periodStart: string,
  periodEndExclusive: string
): Promise<CommissionEstimate> {
  const [{ commissionPct }, { data: orders, error }] = await Promise.all([
    getCommissionConfig(client),
    client
      .from("orders")
      .select("total_amount")
      .eq("store_id", storeId)
      .eq("status", "completed")
      .gte("created_at", periodStart)
      .lt("created_at", periodEndExclusive),
  ]);
  if (error) throw error;

  const orderCount = orders.length;
  const grossRevenue = orders.reduce((sum, o) => sum + o.total_amount, 0);
  const commissionAmount = Math.round((grossRevenue * commissionPct) / 100);
  return { orderCount, grossRevenue, commissionPct, commissionAmount, netPayoutAmount: grossRevenue - commissionAmount };
}

// Generates (persists) one reconciliation snapshot for a store/period.
// Calling this again for an overlapping period is allowed and intentional —
// an admin might regenerate after more orders complete — each call just
// inserts a new snapshot row rather than mutating a prior one, so the
// payout list is a full history, not a single mutable total.
export async function generatePayout(
  admin: SupabaseClient<Database>,
  storeId: string,
  periodStart: string,
  periodEndExclusive: string
): Promise<StorePayout> {
  const estimate = await computeStoreCommissionEstimate(admin, storeId, periodStart, periodEndExclusive);

  const { data: store, error: storeError } = await admin
    .from("stores")
    .select("name")
    .eq("id", storeId)
    .single();
  if (storeError) throw storeError;

  const { data: row, error: insertError } = await admin
    .from("store_payouts")
    .insert({
      store_id: storeId,
      period_start: periodStart,
      period_end: periodEndExclusive,
      order_count: estimate.orderCount,
      gross_revenue: estimate.grossRevenue,
      commission_pct: estimate.commissionPct,
      commission_amount: estimate.commissionAmount,
      net_payout_amount: estimate.netPayoutAmount,
    })
    .select("*")
    .single();
  if (insertError) throw insertError;

  return mapPayout(row, store.name);
}

export async function markPayoutPaid(
  admin: SupabaseClient<Database>,
  payoutId: string,
  adminNote?: string
): Promise<void> {
  const { error } = await admin
    .from("store_payouts")
    .update({ status: "paid", paid_at: new Date().toISOString(), admin_note: adminNote?.trim() || null })
    .eq("id", payoutId);
  if (error) throw error;
}

export interface AdminPayoutListFilter {
  search?: string; // store name
  status?: PayoutStatus;
}

// `status` is applied in the initial query — unlike listStoreSubscriptionsForAdmin's
// "latest row per store" case above, every store_payouts row is already its
// own real, independent reconciliation event (no dedup happening here), so
// filtering the raw rows by status doesn't change the meaning. `search`
// (store name) still needs the join resolved first.
export async function listPayoutsForAdmin(
  admin: SupabaseClient<Database>,
  filter: AdminPayoutListFilter = {}
): Promise<StorePayout[]> {
  let query = admin.from("store_payouts").select("*").order("created_at", { ascending: false });
  if (filter.status) query = query.eq("status", filter.status);

  const { data, error } = await query;
  if (error) throw error;
  if (data.length === 0) return [];

  const storeIds = [...new Set(data.map((r) => r.store_id))];
  const { data: stores, error: storesError } = await admin
    .from("stores")
    .select("id, name")
    .in("id", storeIds);
  if (storesError) throw storesError;
  const storeNameById = new Map(stores.map((s) => [s.id, s.name]));

  let results = data.map((r) => mapPayout(r, storeNameById.get(r.store_id) ?? ""));

  if (filter.search) {
    const needle = filter.search.toLowerCase();
    results = results.filter((r) => r.storeName.toLowerCase().includes(needle));
  }

  return results;
}

// Store's own payout/reconciliation history — regular client,
// store_payouts_select_own RLS (0028) already scopes it to the caller's own
// store, same-actor read, no service-role needed.
export async function listPayoutsForStore(
  client: SupabaseClient<Database>,
  storeId: string
): Promise<StorePayout[]> {
  const { data, error } = await client
    .from("store_payouts")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((r) => mapPayout(r, ""));
}
