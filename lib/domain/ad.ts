export type AdPlacementKey = "hot_deal" | "search_top" | "category_top" | "homepage_banner" | "diamond_partner";
export type AdBookingStatus = "pending_payment" | "active" | "expired" | "cancelled";

export interface AdPlacementType {
  id: string;
  key: AdPlacementKey;
  name: string;
  description: string | null;
  price: number;
  durationDays: number;
  isActive: boolean;
}

export interface AdBooking {
  id: string;
  storeId: string;
  storeName: string;
  placementTypeId: string;
  placementKey: AdPlacementKey;
  placementName: string;
  comboId: string | null;
  comboName: string | null;
  radiusM: number | null;
  bannerImageUrl: string | null;
  linkUrl: string | null;
  status: AdBookingStatus;
  startsAt: string | null;
  endsAt: string | null;
  amountPaid: number | null;
  paymentMethod: "vnpay" | "momo" | null;
  impressionCount: number;
  clickCount: number;
  adminNote: string | null;
  createdAt: string;
}
