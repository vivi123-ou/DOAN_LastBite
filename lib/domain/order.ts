export type OrderStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

export type FulfillmentType = "pickup" | "delivery";
export type PaymentStatus = "unpaid" | "success" | "failed" | "refunded";

// Client-side cart line — never trusted for price at checkout time; the
// server re-fetches the combo and recomputes totals from the live row (see
// order.builder.ts).
export interface CartItem {
  comboId: string;
  storeId: string;
  storeName: string;
  name: string;
  unitPrice: number;
  quantity: number;
  imageUrl: string | null;
  deliverySupported: boolean;
  pickupSupported: boolean;
}

export interface OrderItem {
  id: string;
  comboId: string;
  comboName: string;
  quantity: number;
  unitPriceAtPurchase: number;
  subtotal: number;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string | null;
  customerPhone: string | null;
  storeId: string;
  storeName: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  deliveryAddressLine: string | null;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod: "vnpay" | "momo" | null;
  qrCodeToken: string | null;
  createdAt: string;
  items: OrderItem[];
}

export interface CreateOrderInput {
  customerId: string;
  storeId: string;
  fulfillmentType: FulfillmentType;
  deliveryAddressLine?: string;
  deliveryLat?: number;
  deliveryLng?: number;
  items: { comboId: string; quantity: number }[];
}

export interface StoreMonthlyStats {
  orderCount: number;
  completedOrderCount: number;
  revenue: number;
}
