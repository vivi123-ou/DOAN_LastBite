export interface CommissionConfig {
  commissionPct: number;
  updatedAt: string;
}

export type PayoutStatus = "pending" | "paid";

export interface StorePayout {
  id: string;
  storeId: string;
  storeName: string;
  periodStart: string;
  periodEnd: string;
  orderCount: number;
  grossRevenue: number;
  commissionPct: number;
  commissionAmount: number;
  netPayoutAmount: number;
  status: PayoutStatus;
  paidAt: string | null;
  adminNote: string | null;
  createdAt: string;
}

// One row per store in the admin's live commission report — computed
// on-the-fly from completed orders in a date range, never stored (only a
// *generated* payout, via generatePayout(), gets persisted as a
// store_payouts row).
export interface StoreCommissionReportRow {
  storeId: string;
  storeName: string;
  orderCount: number;
  grossRevenue: number;
  commissionAmount: number;
  netPayoutAmount: number;
}
