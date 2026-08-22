export type ComboStatus = "draft" | "active" | "locked" | "sold_out" | "paused";

export interface ComboItemInput {
  itemName: string;
  itemDescription?: string;
  quantity: number;
}

export interface Combo {
  id: string;
  storeId: string;
  storeOwnerId: string;
  storeName: string;
  storeAddressLine: string;
  categoryId: string;
  name: string;
  description: string | null;
  originalPrice: number;
  currentPrice: number;
  initialStock: number;
  remainingStock: number;
  bestBefore: string;
  // Needed by StockBasedDecayStrategy to compute how far through the
  // combo's own listed_at→best_before window `now` is — see
  // lib/pricing/strategies/stock-based-decay.strategy.ts.
  createdAt: string;
  // Store-owner-chosen ceiling for dynamic pricing (0025_combo_max_discount.sql),
  // percentage 10-70 — how deep this combo's price is ever allowed to drop.
  // The continuous time×stock formula still decides the actual price at any
  // given moment; this only bounds how far it can go.
  maxDiscountPct: number;
  deliverySupported: boolean;
  pickupSupported: boolean;
  status: ComboStatus;
  items: { id: string; itemName: string; itemDescription: string | null; quantity: number }[];
  images: string[];
}

// Lightweight read used for order validation/pricing at checkout — the full
// Combo (with items/images) is unnecessary overhead there. Never trust a
// client-supplied price/stock number; always re-fetch this at submit time.
export interface ComboSnapshot {
  id: string;
  storeId: string;
  name: string;
  currentPrice: number;
  status: ComboStatus;
  bestBefore: string;
  remainingStock: number;
  deliverySupported: boolean;
  pickupSupported: boolean;
}

export interface NearbyCombo {
  comboId: string;
  name: string;
  currentPrice: number;
  originalPrice: number;
  bestBefore: string;
  storeId: string;
  storeName: string;
  distanceM: number;
  imageUrl: string | null;
  deliverySupported: boolean;
  pickupSupported: boolean;
  // Has an active hot_deal/search_top/category_top ad booking (0035) —
  // already boosted to the front of this exact result set by nearby_combos()/
  // search_combos() themselves, this flag is purely for the "Được tài trợ"
  // badge on the card, not something the client needs to re-sort by.
  isSponsored: boolean;
}

// Slim shape for the map's store detail panel (store-detail-panel.tsx) —
// deliberately not NearbyCombo: there's no meaningful "distance" to show
// (you're already looking at this exact store) and no delivery/pickup
// flags needed since the panel is browse-only, not add-to-cart.
export interface StoreComboSummary {
  comboId: string;
  name: string;
  currentPrice: number;
  originalPrice: number;
  bestBefore: string;
  imageUrl: string | null;
}

export interface CreateComboInput {
  storeId: string;
  categoryId: string;
  name: string;
  description?: string;
  originalPrice: number;
  initialStock: number;
  bestBeforeOverride?: Date;
  // Store-owner-chosen dynamic-pricing ceiling — see Combo.maxDiscountPct.
  maxDiscountPct: number;
  deliverySupported: boolean;
  pickupSupported: boolean;
  items: ComboItemInput[];
  imageUrls: string[];
}
