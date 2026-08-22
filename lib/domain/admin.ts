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
  // Sum of amount_paid across every 'active' or 'expired' ad_bookings row
  // (0035) — a fourth, separate revenue stream (Quảng cáo), distinct from
  // orders/subscriptions/commission.
  adRevenue: number;
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
  storeId: string;
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
  imageUrls: string[];
  // The store owner's own reply, if they posted one before an admin got to
  // it (dashboard/feedback's respondToReportAction) — surfaced here so an
  // admin sees both sides before resolving.
  storeResponse: string | null;
}

export interface AdminUserSummary {
  id: string;
  fullName: string | null;
  role: string;
  orderCount: number;
  netZeroPoints: number;
  createdAt: string;
  // Resolved via the Supabase Auth admin API (auth.users has no client-
  // queryable table — `profiles` never stored email), not a plain repository
  // column read. null if that lookup fails for a given row (best-effort,
  // never blocks the rest of the list from rendering).
  email: string | null;
}

// A single store's recent orders, for the admin store-detail page
// (app/(admin)/admin/stores/[id]) — a lightweight read, not the full
// customer-facing Order domain shape (no line items, no QR, etc.), since
// this is just "does this store have real order activity," not a
// fulfillment view.
export interface AdminOrderSummary {
  id: string;
  customerName: string | null;
  status: string;
  totalAmount: number;
  createdAt: string;
}

// Counts surfaced as small badges on AdminSidebar — fetched once in
// app/(admin)/admin/layout.tsx (a Server Component) and passed down, since
// the sidebar itself is a Client Component (usePathname() for the active-
// route highlight) and can't fetch this on its own.
export interface AdminSidebarCounts {
  pendingStores: number;
  openReports: number;
}
