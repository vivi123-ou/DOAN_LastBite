import type { ComboRatingSummary } from "@/lib/domain/review";

// Phase 4's "full Premium monthly report" — everything a store owner would
// want to know about one specific calendar month, in one place, computed
// live from report.repository.ts's getMonthlyStoreReport() (never stored;
// same recompute-don't-persist posture as every other derived number in
// this app).
export interface MonthlyStoreReport {
  year: number;
  month: number; // 1-12
  orderCount: number;
  grossRevenue: number;
  commissionPct: number;
  commissionAmount: number;
  netRevenue: number;
  co2SavedKg: number;
  foodRescuedKg: number;
  topSellingCombos: { comboId: string; comboName: string; unitsSold: number }[];
  topRatedCombos: ComboRatingSummary[];
  lowestRatedCombos: ComboRatingSummary[];
  reportCount: number;
}
