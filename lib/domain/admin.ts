export interface AdminOverviewStats {
  totalUsers: number;
  totalStores: number;
  verifiedStores: number;
  pendingStores: number;
  totalOrders: number;
  completedOrders: number;
  totalRevenue: number;
  // Sum of amount_paid across every 'active' store_subscriptions row —
  // gói dịch vụ revenue specifically, kept separate from order revenue
  // above (they're genuinely different revenue streams).
  subscriptionRevenue: number;
  // Platform commission owed across every store for the current calendar
  // month, computed live from completed orders (same formula as
  // commission.repository.ts's computeCommissionReport()) — a third,
  // separate revenue stream from subscriptions.
  commissionRevenueThisMonth: number;
  totalCo2SavedKg: number;
  // Derived from totalCo2SavedKg using the user's own stated conversion
  // (1kg food rescued ≈ 2.5kg CO2 avoided) — this app's co2_factors seed
  // data tracks kg-CO2-per-combo directly, not food weight, so there's
  // nothing to sum here; computed for display, not separately stored,
  // same "don't store twice" spirit as the dynamic-pricing breakdown.
  totalFoodRescuedKg: number;
  openReportsCount: number;
}

export interface AdminStoreSummary {
  id: string;
  name: string;
  ownerName: string | null;
  addressLine: string;
  verificationStatus: "pending" | "verified" | "rejected" | "suspended";
  isActive: boolean;
  createdAt: string;
}

export interface AdminComboSummary {
  id: string;
  name: string;
  storeName: string;
  originalPrice: number;
  currentPrice: number;
  status: string;
  bestBefore: string;
  remainingStock: number;
  initialStock: number;
}

export interface AdminReportSummary {
  id: string;
  comboName: string;
  storeName: string;
  customerName: string | null;
  comment: string | null;
  createdAt: string;
  resolvedAt: string | null;
  adminNote: string | null;
}

export interface AdminUserSummary {
  id: string;
  fullName: string | null;
  role: string;
  orderCount: number;
  netZeroPoints: number;
  createdAt: string;
}
