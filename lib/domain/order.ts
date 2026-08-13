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

// order_status_history (0023) — a real per-transition timestamp record, so
// the customer/store timeline can show "vào lúc mấy giờ, đã tới trạng thái
// nào" instead of just the single current status. Newest first, matching
// the Shopee/Fahasa-style tracking reference the timeline UI is modeled on.
export interface OrderStatusEvent {
  status: OrderStatus;
  changedAt: string;
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
  bulkDiscountPct: number;
  groupOrderId: string | null;
  netZeroPointsUsed: number;
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
  // How many Net Zero points the customer asked to redeem, and their real
  // balance at build time (fetched fresh by the caller — cart/actions.ts —
  // never trusted from the client, same rule as combo prices/stock).
  netZeroPointsToApply?: number;
  availableNetZeroPoints?: number;
  // Checking out "theo nhóm" (group-buy) — groupOrderId comes straight from
  // the client, but bulkDiscountPct is always resolved fresh server-side by
  // the caller (group-buy.repository.ts's resolveCheckoutDiscount()) from
  // the group's live total quantity, never trusted from the client, same
  // rule as everything else here.
  groupOrderId?: string;
  bulkDiscountPct?: number;
}

export interface StoreMonthlyStats {
  orderCount: number;
  completedOrderCount: number;
  revenue: number;
}
