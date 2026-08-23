import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { MonthlyStoreReport } from "@/lib/domain/report";
import { computeStoreCommissionEstimate } from "@/lib/repositories/commission.repository";
import { getStoreImpact } from "@/lib/repositories/net-zero.repository";
import { getStoreStats } from "@/lib/repositories/review.repository";

// The "full Premium monthly report" flagged as remaining phase-4 work — a
// genuinely new aggregate root (a report is its own thing, not naturally
// owned by order/commission/net-zero/review repositories individually),
// combining data every one of those repositories already exposes rather
// than duplicating any of it. Every number here is recomputed live for the
// requested month, never stored — same "recompute, don't persist a second
// copy" posture as everything else derived in this app (dynamic pricing,
// commission estimates, Net Zero balances).
export async function getMonthlyStoreReport(
  admin: SupabaseClient<Database>,
  storeId: string,
  year: number,
  month: number // 1-12
): Promise<MonthlyStoreReport> {
  const periodStart = new Date(year, month - 1, 1).toISOString();
  const periodEndExclusive = new Date(year, month, 1).toISOString();
  // Previous calendar month, for the growth comparison below — handles a
  // January request correctly (month=1 → new Date(year, 0, 1) is already
  // January; new Date(year, -1, 1) rolls back to December of year-1, JS
  // Date's own well-defined month-overflow behavior, not a special case
  // that needs its own branch).
  const prevPeriodStart = new Date(year, month - 2, 1).toISOString();
  const prevPeriodEndExclusive = periodStart;

  const [estimate, prevEstimate, netZeroImpact, reviewStats, topSelling] = await Promise.all([
    computeStoreCommissionEstimate(admin, storeId, periodStart, periodEndExclusive),
    computeStoreCommissionEstimate(admin, storeId, prevPeriodStart, prevPeriodEndExclusive),
    getStoreImpact(admin, storeId, periodStart, periodEndExclusive),
    getStoreStats(admin, storeId, periodStart, periodEndExclusive),
    getTopSellingCombos(admin, storeId, periodStart, periodEndExclusive),
  ]);

  const revenueGrowthPct =
    prevEstimate.grossRevenue > 0
      ? ((estimate.grossRevenue - prevEstimate.grossRevenue) / prevEstimate.grossRevenue) * 100
      : null;
  const orderCountGrowthPct =
    prevEstimate.orderCount > 0
      ? ((estimate.orderCount - prevEstimate.orderCount) / prevEstimate.orderCount) * 100
      : null;

  return {
    year,
    month,
    orderCount: estimate.orderCount,
    grossRevenue: estimate.grossRevenue,
    commissionPct: estimate.commissionPct,
    commissionAmount: estimate.commissionAmount,
    netRevenue: estimate.netPayoutAmount,
    co2SavedKg: netZeroImpact.totalCo2SavedKg,
    foodRescuedKg: netZeroImpact.totalFoodRescuedKg,
    topSellingCombos: topSelling,
    topRatedCombos: reviewStats.topRated,
    lowestRatedCombos: reviewStats.lowestRated,
    reportCount: reviewStats.reportCount,
    previousMonthRevenue: prevEstimate.grossRevenue,
    revenueGrowthPct,
    orderCountGrowthPct,
  };
}

// Two-step (order ids, then order_items for those ids), not an embedded
// join — same reasoning as every other cross-table read in this codebase's
// hand-maintained database.types.ts (empty Relationships arrays throughout,
// so an embedded select wouldn't type cleanly). Small aggregation in JS
// over a single calendar month's worth of one store's orders — bounded,
// same "small aggregation over a narrow query" preference already used for
// getTopPurchasedCategoryIds()/getPeakSellingHour() elsewhere in this app.
async function getTopSellingCombos(
  admin: SupabaseClient<Database>,
  storeId: string,
  periodStart: string,
  periodEndExclusive: string
): Promise<{ comboId: string; comboName: string; unitsSold: number }[]> {
  const { data: orders, error: ordersError } = await admin
    .from("orders")
    .select("id")
    .eq("store_id", storeId)
    .eq("status", "completed")
    .gte("created_at", periodStart)
    .lt("created_at", periodEndExclusive);
  if (ordersError) throw ordersError;
  if (orders.length === 0) return [];

  const { data: items, error: itemsError } = await admin
    .from("order_items")
    .select("combo_id, quantity")
    .in(
      "order_id",
      orders.map((o) => o.id)
    );
  if (itemsError) throw itemsError;
  if (items.length === 0) return [];

  const unitsByCombo = new Map<string, number>();
  for (const item of items) {
    unitsByCombo.set(item.combo_id, (unitsByCombo.get(item.combo_id) ?? 0) + item.quantity);
  }

  const comboIds = [...unitsByCombo.keys()];
  const { data: combos, error: combosError } = await admin.from("combos").select("id, name").in("id", comboIds);
  if (combosError) throw combosError;
  const nameById = new Map((combos ?? []).map((c) => [c.id, c.name]));

  return [...unitsByCombo.entries()]
    .map(([comboId, unitsSold]) => ({ comboId, comboName: nameById.get(comboId) ?? "", unitsSold }))
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, 5);
}
