import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type {
  AdminOverviewStats,
  AdminStoreSummary,
  AdminComboSummary,
  AdminReportSummary,
  AdminUserSummary,
} from "@/lib/domain/admin";
import { computeStockBasedDecayPrice } from "@/lib/pricing/strategies/stock-based-decay.strategy";
import { getCommissionConfig } from "@/lib/repositories/commission.repository";

// Every function in this file requires the service-role admin client —
// an admin genuinely needs to read/act across every store and customer
// regardless of RLS, same cross-actor posture already established for
// payments/notifications (.claude/rules/database-and-schema.md). There are
// no admin-specific RLS policies anywhere; access to the /admin route
// itself is gated at the app layer (app/(admin)/admin/layout.tsx checking
// profiles.role = 'admin'), not by loosening what a regular client can see.

export async function getOverviewStats(admin: SupabaseClient<Database>): Promise<AdminOverviewStats> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    { count: totalUsers, error: usersError },
    { data: stores, error: storesError },
    { data: orders, error: ordersError },
    { data: ledgerRows, error: ledgerError },
    { count: openReportsCount, error: reportsError },
    { data: subscriptionRows, error: subscriptionsError },
    { commissionPct },
    { data: monthOrders, error: monthOrdersError },
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("stores").select("verification_status"),
    admin.from("orders").select("status, total_amount"),
    admin.from("net_zero_ledger").select("co2_saved_kg"),
    admin
      .from("combo_reviews")
      .select("id", { count: "exact", head: true })
      .eq("kind", "report")
      .is("resolved_at", null),
    admin.from("store_subscriptions").select("amount_paid").eq("status", "active"),
    // Same "missing table degrades gracefully on a pre-existing critical
    // page" exception used for combo_reviews/order_status_history — this
    // overview page predates commission_config (0028); a store that hasn't
    // run that migration yet shouldn't lose the whole /admin overview over
    // one new stat card.
    getCommissionConfig(admin).catch(() => ({ commissionPct: 0 })),
    admin
      .from("orders")
      .select("total_amount")
      .eq("status", "completed")
      .gte("created_at", startOfMonth.toISOString()),
  ]);
  if (usersError) throw usersError;
  if (storesError) throw storesError;
  if (ordersError) throw ordersError;
  if (ledgerError) throw ledgerError;
  if (reportsError) throw reportsError;
  if (subscriptionsError) throw subscriptionsError;
  if (monthOrdersError) throw monthOrdersError;

  const completedOrders = (orders ?? []).filter((o) => o.status === "completed");
  const totalCo2SavedKg = (ledgerRows ?? []).reduce((sum, r) => sum + r.co2_saved_kg, 0);
  const monthGrossRevenue = (monthOrders ?? []).reduce((sum, o) => sum + o.total_amount, 0);

  return {
    totalUsers: totalUsers ?? 0,
    totalStores: (stores ?? []).length,
    verifiedStores: (stores ?? []).filter((s) => s.verification_status === "verified").length,
    pendingStores: (stores ?? []).filter((s) => s.verification_status === "pending").length,
    totalOrders: (orders ?? []).length,
    completedOrders: completedOrders.length,
    totalRevenue: completedOrders.reduce((sum, o) => sum + o.total_amount, 0),
    subscriptionRevenue: (subscriptionRows ?? []).reduce((sum, r) => sum + (r.amount_paid ?? 0), 0),
    commissionRevenueThisMonth: Math.round((monthGrossRevenue * commissionPct) / 100),
    totalCo2SavedKg,
    totalFoodRescuedKg: totalCo2SavedKg / 2.5,
    openReportsCount: openReportsCount ?? 0,
  };
}

export async function listStoresForAdmin(admin: SupabaseClient<Database>): Promise<AdminStoreSummary[]> {
  const { data, error } = await admin
    .from("stores")
    .select("id, name, address_line, verification_status, is_active, created_at, owner_id")
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (data.length === 0) return [];

  const ownerIds = [...new Set(data.map((s) => s.owner_id))];
  const { data: owners, error: ownersError } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", ownerIds);
  if (ownersError) throw ownersError;
  const ownerNameById = new Map(owners.map((o) => [o.id, o.full_name]));

  return data.map((s) => ({
    id: s.id,
    name: s.name,
    ownerName: ownerNameById.get(s.owner_id) ?? null,
    addressLine: s.address_line,
    verificationStatus: s.verification_status,
    isActive: s.is_active,
    createdAt: s.created_at,
  }));
}

export async function updateStoreVerification(
  admin: SupabaseClient<Database>,
  storeId: string,
  status: "pending" | "verified" | "rejected" | "suspended"
): Promise<void> {
  const { error } = await admin.from("stores").update({ verification_status: status }).eq("id", storeId);
  if (error) throw error;
}

export async function updateStoreActive(
  admin: SupabaseClient<Database>,
  storeId: string,
  isActive: boolean
): Promise<void> {
  const { error } = await admin.from("stores").update({ is_active: isActive }).eq("id", storeId);
  if (error) throw error;
}

// Read-only monitor — no write path here on purpose; a store's own owner
// still manages their combos through the existing /dashboard/combos flow.
// Limited to the 200 most recent so this stays a quick system-wide glance,
// not a full paginated catalog browser.
export async function listCombosForAdmin(admin: SupabaseClient<Database>): Promise<AdminComboSummary[]> {
  const { data, error } = await admin
    .from("combos")
    .select(
      "id, name, original_price, initial_stock, remaining_stock, created_at, best_before, status, store_id, max_discount_pct"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  if (data.length === 0) return [];

  const storeIds = [...new Set(data.map((c) => c.store_id))];
  const { data: stores, error: storesError } = await admin
    .from("stores")
    .select("id, name")
    .in("id", storeIds);
  if (storesError) throw storesError;
  const storeNameById = new Map(stores.map((s) => [s.id, s.name]));

  return data.map((c) => ({
    id: c.id,
    name: c.name,
    storeName: storeNameById.get(c.store_id) ?? "",
    originalPrice: c.original_price,
    currentPrice: computeStockBasedDecayPrice({
      originalPrice: c.original_price,
      initialStock: c.initial_stock,
      remainingStock: c.remaining_stock,
      createdAt: c.created_at,
      bestBefore: c.best_before,
      maxDiscountPct: c.max_discount_pct,
    }),
    status: c.status,
    bestBefore: c.best_before,
    remainingStock: c.remaining_stock,
    initialStock: c.initial_stock,
  }));
}

export async function listReportsForAdmin(admin: SupabaseClient<Database>): Promise<AdminReportSummary[]> {
  const { data, error } = await admin
    .from("combo_reviews")
    .select("id, comment, created_at, resolved_at, admin_note, combo_id, store_id, customer_id")
    .eq("kind", "report")
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (data.length === 0) return [];

  const comboIds = [...new Set(data.map((r) => r.combo_id))];
  const storeIds = [...new Set(data.map((r) => r.store_id))];
  const customerIds = [...new Set(data.map((r) => r.customer_id))];

  const [
    { data: combos, error: combosError },
    { data: stores, error: storesError },
    { data: customers, error: customersError },
  ] = await Promise.all([
    admin.from("combos").select("id, name").in("id", comboIds),
    admin.from("stores").select("id, name").in("id", storeIds),
    admin.from("profiles").select("id, full_name").in("id", customerIds),
  ]);
  if (combosError) throw combosError;
  if (storesError) throw storesError;
  if (customersError) throw customersError;

  const comboNameById = new Map(combos.map((c) => [c.id, c.name]));
  const storeNameById = new Map(stores.map((s) => [s.id, s.name]));
  const customerNameById = new Map(customers.map((c) => [c.id, c.full_name]));

  return data.map((r) => ({
    id: r.id,
    comboName: comboNameById.get(r.combo_id) ?? "",
    storeName: storeNameById.get(r.store_id) ?? "",
    customerName: customerNameById.get(r.customer_id) ?? null,
    comment: r.comment,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    adminNote: r.admin_note,
  }));
}

export async function resolveReport(
  admin: SupabaseClient<Database>,
  reportId: string,
  adminNote?: string
): Promise<void> {
  const { error } = await admin
    .from("combo_reviews")
    .update({ resolved_at: new Date().toISOString(), admin_note: adminNote?.trim() || null })
    .eq("id", reportId);
  if (error) throw error;
}

// Plain-JS order-count aggregation over the same `orders` table, same
// "small aggregation over a narrow RPC" preference already established for
// order.repository.ts's getTopPurchasedCategoryIds(). Limited to the 200
// most recently created accounts.
export async function listUsersForAdmin(admin: SupabaseClient<Database>): Promise<AdminUserSummary[]> {
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, full_name, role, net_zero_points, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  if (profiles.length === 0) return [];

  const { data: orders, error: ordersError } = await admin.from("orders").select("customer_id");
  if (ordersError) throw ordersError;
  const orderCountByCustomer = new Map<string, number>();
  for (const o of orders) {
    orderCountByCustomer.set(o.customer_id, (orderCountByCustomer.get(o.customer_id) ?? 0) + 1);
  }

  return profiles.map((p) => ({
    id: p.id,
    fullName: p.full_name,
    role: p.role,
    orderCount: orderCountByCustomer.get(p.id) ?? 0,
    netZeroPoints: p.net_zero_points,
    createdAt: p.created_at,
  }));
}
