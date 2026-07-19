export type ComboStatus = "draft" | "active" | "locked" | "sold_out" | "paused";

export interface ComboItemInput {
  itemName: string;
  itemDescription?: string;
  quantity: number;
}

export interface Combo {
  id: string;
  storeId: string;
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
  deliverySupported: boolean;
  pickupSupported: boolean;
  status: ComboStatus;
  items: { id: string; itemName: string; itemDescription: string | null; quantity: number }[];
  images: string[];
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
}

export interface CreateComboInput {
  storeId: string;
  categoryId: string;
  name: string;
  description?: string;
  originalPrice: number;
  initialStock: number;
  bestBeforeOverride?: Date;
  deliverySupported: boolean;
  pickupSupported: boolean;
  items: ComboItemInput[];
  imageUrls: string[];
}
