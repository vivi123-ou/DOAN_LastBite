export type ReviewKind = "review" | "report";

export interface ComboReview {
  id: string;
  orderId: string;
  orderItemId: string;
  comboId: string;
  comboName: string;
  customerId: string;
  customerName: string | null;
  storeId: string;
  kind: ReviewKind;
  rating: number | null;
  comment: string | null;
  createdAt: string;
  imageUrls: string[];
  // Only ever meaningful for kind = 'report' — a store owner's one written
  // reply to a complaint about their own store, before/instead of an admin
  // ever weighing in.
  storeResponse: string | null;
  storeRespondedAt: string | null;
  // Admin report-handling (0026) — null until an admin marks it looked-at.
  resolvedAt: string | null;
}

export interface CreateReviewInput {
  orderId: string;
  orderItemId: string;
  kind: ReviewKind;
  rating?: number;
  comment?: string;
  imageUrls?: string[];
}

// Per-combo aggregate shown on the combo detail page and the store's
// dashboard analytics — computed in JS from the raw rows (this repo
// already prefers a small JS aggregation over a narrow SQL RPC for
// similar one-off stats, see order.repository.ts's
// getTopPurchasedCategoryIds()).
export interface ComboRatingSummary {
  comboId: string;
  comboName: string;
  averageRating: number;
  reviewCount: number;
}

export interface StoreReviewStats {
  topRated: ComboRatingSummary[];
  lowestRated: ComboRatingSummary[];
  reportCount: number;
}
