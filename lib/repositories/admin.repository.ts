import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type {
  AdminOverviewStats,
  AdminStoreSummary,
  AdminComboSummary,
  AdminReportSummary,
  AdminUserSummary,
  AdminOrderSummary,
  AdminSidebarCounts,
} from "@/lib/domain/admin";
import { getCommissionConfig } from "@/lib/repositories/commission.repository";
import type { ComboStatus } from "@/lib/domain/combo";
import type { UserRole } from "@/lib/domain/profile";
import { ADMIN_PAGE_SIZE, type PaginatedResult } from "@/lib/domain/pagination";

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

export interface AdminStoreListFilter {
  search?: string;
  status?: AdminStoreSummary["verificationStatus"];
  page?: number; // 1-based
}

// Real server-side pagination + index-backed search, via the
// `admin_search_stores()` RPC (0029) — replaces the old "fetch every
// matching row, no cap at all" version. Uses the same
// `lower(f_unaccent(name)) ilike` expression `idx_stores_name_trgm` (0001)
// is built on, so the trigram index actually gets used instead of a
// sequential scan.
export async function listStoresForAdmin(
  admin: SupabaseClient<Database>,
  filter: AdminStoreListFilter = {}
): Promise<PaginatedResult<AdminStoreSummary>> {
  const page = filter.page ?? 1;
  const { data, error } = await admin.rpc("admin_search_stores", {
    search_text: filter.search ?? null,
    status_filter: filter.status ?? null,
    limit_n: ADMIN_PAGE_SIZE,
    offset_n: (page - 1) * ADMIN_PAGE_SIZE,
  });
  if (error) throw error;

  return {
    items: data.map((s) => ({
      id: s.id,
      name: s.name,
      ownerName: s.owner_name,
      addressLine: s.address_line,
      verificationStatus: s.verification_status as AdminStoreSummary["verificationStatus"],
      isActive: s.is_active,
      createdAt: s.created_at,
    })),
    totalCount: data[0]?.total_count ?? 0,
  };
}

// Single-store lookup for the admin store-detail page
// (app/(admin)/admin/stores/[id]) — same shape as listStoresForAdmin's
// items, just narrowed to one row via the same RPC's search_text-as-exact-id
// isn't applicable here, so this queries the table directly instead (no
// pagination/search concern for a single-row lookup).
export async function getStoreDetailForAdmin(
  admin: SupabaseClient<Database>,
  storeId: string
): Promise<AdminStoreSummary | null> {
  const { data: store, error } = await admin
    .from("stores")
    .select("id, name, address_line, verification_status, is_active, created_at, owner_id")
    .eq("id", storeId)
    .maybeSingle();
  if (error) throw error;
  if (!store) return null;

  const { data: owner } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", store.owner_id)
    .maybeSingle();

  return {
    id: store.id,
    name: store.name,
    ownerName: owner?.full_name ?? null,
    addressLine: store.address_line,
    verificationStatus: store.verification_status,
    isActive: store.is_active,
    createdAt: store.created_at,
  };
}

// A store's recent orders — for the admin store-detail page. Plain direct
// query (no repository elsewhere already exposes an admin-wide "orders for
// store X" read), limited to the most recent 20 since this is a quick
// activity glance, not a full order-management view (that's the store
// owner's own /dashboard/orders).
export async function listOrdersForStoreAdmin(
  admin: SupabaseClient<Database>,
  storeId: string,
  limit = 20
): Promise<AdminOrderSummary[]> {
  const { data, error } = await admin
    .from("orders")
    .select("id, status, total_amount, created_at, customer_id")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (data.length === 0) return [];

  const customerIds = [...new Set(data.map((o) => o.customer_id))];
  const { data: customers, error: customersError } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", customerIds);
  if (customersError) throw customersError;
  const nameById = new Map(customers.map((c) => [c.id, c.full_name]));

  return data.map((o) => ({
    id: o.id,
    customerName: nameById.get(o.customer_id) ?? null,
    status: o.status,
    totalAmount: o.total_amount,
    createdAt: o.created_at,
  }));
}

// Small counts surfaced as badges on AdminSidebar — cheap `head: true`
// count-only queries, not full row fetches.
export async function getSidebarCounts(admin: SupabaseClient<Database>): Promise<AdminSidebarCounts> {
  const [{ count: pendingStores, error: storesError }, { count: openReports, error: reportsError }] =
    await Promise.all([
      admin
        .from("stores")
        .select("id", { count: "exact", head: true })
        .eq("verification_status", "pending"),
      admin
        .from("combo_reviews")
        .select("id", { count: "exact", head: true })
        .eq("kind", "report")
        .is("resolved_at", null),
    ]);
  if (storesError) throw storesError;
  if (reportsError) throw reportsError;
  return { pendingStores: pendingStores ?? 0, openReports: openReports ?? 0 };
}

export async function updateStoreVerification(
  admin: SupabaseClient<Database>,
  storeId: string,
  status: "pending" | "verified" | "rejected" | "suspended"
): Promise<void> {
  const { error } = await admin.from("stores").update({ verification_status: status }).eq("id", storeId);
  if (error) throw error;
}

// Bulk variant — same single `update ... where id = any(...)` shape as a
// single-row update, just scoped to a list of ids instead of one. Used by
// the "Duyệt các mục đã chọn" bulk action on /admin/stores so an admin
// approving many pending stores at once doesn't have to click through each
// one individually.
export async function bulkSetStoreVerification(
  admin: SupabaseClient<Database>,
  storeIds: string[],
  status: "pending" | "verified" | "rejected" | "suspended"
): Promise<void> {
  if (storeIds.length === 0) return;
  const { error } = await admin.from("stores").update({ verification_status: status }).in("id", storeIds);
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

export interface AdminComboListFilter {
  search?: string;
  status?: ComboStatus;
  storeId?: string;
  page?: number; // 1-based
}

// Read-only monitor — no write path here on purpose; a store's own owner
// still manages their combos through the existing /dashboard/combos flow.
// Real server-side pagination + index-backed search via `admin_search_combos()`
// (0029), replacing the old hard `.limit(200)` — a filtered match is now
// always findable regardless of how old it is, not just within the 200
// most-recent rows. The RPC also computes `current_price` itself (calling
// the same `dynamic_combo_price()` nearby_combos()/search_combos() use) so
// this function no longer needs to fetch raw columns and recompute the
// price in JS.
export async function listCombosForAdmin(
  admin: SupabaseClient<Database>,
  filter: AdminComboListFilter = {}
): Promise<PaginatedResult<AdminComboSummary>> {
  const page = filter.page ?? 1;
  const { data, error } = await admin.rpc("admin_search_combos", {
    search_text: filter.search ?? null,
    status_filter: filter.status ?? null,
    store_id_filter: filter.storeId ?? null,
    limit_n: ADMIN_PAGE_SIZE,
    offset_n: (page - 1) * ADMIN_PAGE_SIZE,
  });
  if (error) throw error;

  return {
    items: data.map((c) => ({
      id: c.id,
      name: c.name,
      storeId: c.store_id,
      storeName: c.store_name,
      originalPrice: c.original_price,
      currentPrice: c.current_price,
      status: c.status,
      bestBefore: c.best_before,
      remainingStock: c.remaining_stock,
      initialStock: c.initial_stock,
    })),
    totalCount: data[0]?.total_count ?? 0,
  };
}

export interface AdminReportListFilter {
  // Matches against comboName/storeName/customerName/comment — all only
  // known after the join below, so unlike the filters above this one is
  // applied in JS at the end, not in the initial SQL query. Safe here
  // (unlike listCombosForAdmin/listUsersForAdmin) because every matching
  // row is fetched before pagination is applied — see the comment below.
  search?: string;
  resolved?: "open" | "resolved";
  storeId?: string;
  page?: number; // 1-based
}

// Every report matching `resolved`/`storeId` (both pushed into the SQL
// query) is fetched, then `search` and pagination both apply afterward in
// JS. Not index-backed the way listStoresForAdmin/listCombosForAdmin/
// listUsersForAdmin now are (their `admin_search_*()` RPCs paginate before
// the join) — an acceptable tradeoff specifically for this list: reports
// only exist per filed complaint, so this table stays far smaller than
// combos/users even at real scale, and its search needs to match across
// three *joined* names + free-text comment, which the RPC approach doesn't
// cleanly support without a much bigger query. Real pagination (slicing
// after the filter) still bounds what actually renders per page.
export async function listReportsForAdmin(
  admin: SupabaseClient<Database>,
  filter: AdminReportListFilter = {}
): Promise<PaginatedResult<AdminReportSummary>> {
  let query = admin
    .from("combo_reviews")
    .select(
      "id, comment, created_at, resolved_at, admin_note, combo_id, store_id, customer_id, image_urls, store_response"
    )
    .eq("kind", "report")
    .order("created_at", { ascending: false });
  if (filter.resolved === "open") query = query.is("resolved_at", null);
  if (filter.resolved === "resolved") query = query.not("resolved_at", "is", null);
  if (filter.storeId) query = query.eq("store_id", filter.storeId);

  const { data, error } = await query;
  if (error) throw error;
  if (data.length === 0) return { items: [], totalCount: 0 };

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

  let results = data.map((r) => ({
    id: r.id,
    comboName: comboNameById.get(r.combo_id) ?? "",
    storeName: storeNameById.get(r.store_id) ?? "",
    customerName: customerNameById.get(r.customer_id) ?? null,
    comment: r.comment,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    adminNote: r.admin_note,
    imageUrls: r.image_urls,
    storeResponse: r.store_response,
  }));

  if (filter.search) {
    const needle = filter.search.toLowerCase();
    results = results.filter(
      (r) =>
        r.comboName.toLowerCase().includes(needle) ||
        r.storeName.toLowerCase().includes(needle) ||
        (r.customerName?.toLowerCase().includes(needle) ?? false) ||
        (r.comment?.toLowerCase().includes(needle) ?? false)
    );
  }

  const totalCount = results.length;
  const page = filter.page ?? 1;
  const start = (page - 1) * ADMIN_PAGE_SIZE;
  return { items: results.slice(start, start + ADMIN_PAGE_SIZE), totalCount };
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

// Bulk variant — no per-row note (a shared note wouldn't make sense across
// different reports), used by the "Đánh dấu đã xử lý" bulk action on
// /admin/reports so an admin clearing out several open reports at once
// doesn't have to open/confirm each one's own note dialog individually.
export async function bulkResolveReports(
  admin: SupabaseClient<Database>,
  reportIds: string[]
): Promise<void> {
  if (reportIds.length === 0) return;
  const { error } = await admin
    .from("combo_reviews")
    .update({ resolved_at: new Date().toISOString() })
    .in("id", reportIds);
  if (error) throw error;
}

export interface AdminUserListFilter {
  search?: string;
  role?: UserRole;
  page?: number; // 1-based
}

// Real server-side pagination + index-backed search via `admin_search_users()`
// (0029) — replaces the old hard `.limit(200)` and the old JS aggregation
// over *every* row of `orders` on every page load (order_count is now
// computed inside the RPC's own grouped join, a real scaling win
// independent of how many users are on this page). Email is resolved
// per-row afterward via the Supabase Auth admin API (`profiles` has no
// email column — Supabase Auth keeps that in its own `auth.users`, not a
// plain-query-able table) — only for the current page's rows, not the
// whole user base, since that API has no bulk "get by id list" call.
export async function listUsersForAdmin(
  admin: SupabaseClient<Database>,
  filter: AdminUserListFilter = {}
): Promise<PaginatedResult<AdminUserSummary>> {
  const page = filter.page ?? 1;
  const { data, error } = await admin.rpc("admin_search_users", {
    search_text: filter.search ?? null,
    role_filter: filter.role ?? null,
    limit_n: ADMIN_PAGE_SIZE,
    offset_n: (page - 1) * ADMIN_PAGE_SIZE,
  });
  if (error) throw error;

  const emailById = new Map<string, string | null>();
  await Promise.all(
    data.map(async (p) => {
      try {
        const { data: authUser } = await admin.auth.admin.getUserById(p.id);
        emailById.set(p.id, authUser.user?.email ?? null);
      } catch {
        // Best-effort — a single lookup failure shouldn't blank out the
        // whole page, the row just shows "—" for email like any other
        // account whose email genuinely isn't available.
        emailById.set(p.id, null);
      }
    })
  );

  return {
    items: data.map((p) => ({
      id: p.id,
      fullName: p.full_name,
      role: p.role,
      orderCount: p.order_count,
      netZeroPoints: p.net_zero_points,
      createdAt: p.created_at,
      email: emailById.get(p.id) ?? null,
    })),
    totalCount: data[0]?.total_count ?? 0,
  };
}
