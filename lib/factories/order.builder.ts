import type { ComboSnapshot } from "@/lib/domain/combo";
import type { CreateOrderInput } from "@/lib/domain/order";

export interface BuiltOrder {
  order: {
    customer_id: string;
    store_id: string;
    fulfillment_type: "pickup" | "delivery";
    subtotal: number;
    discount_amount: number;
    bulk_discount_pct: number;
    total_amount: number;
  };
  items: {
    combo_id: string;
    quantity: number;
    unit_price_at_purchase: number;
    subtotal: number;
    // Stock snapshot at build time, so order.repository.ts create() can
    // decrement with a plain update() instead of a read-then-write round
    // trip. Narrows but doesn't close the race window between validation
    // and insert — accepted tradeoff for this scope (no row-locking
    // Postgres function), see .claude/rules/database-and-schema.md-style
    // "known simplification" notes elsewhere in this repo.
    remainingStockBeforeOrder: number;
  }[];
  delivery?: { addressLine: string; lat: number; lng: number };
}

// Cart -> order construction: validates the cart against freshly-fetched
// ComboSnapshots (never the client's cached prices/stock) and computes
// totals. Mirrors combo.builder.ts's ComboBuilder — multi-step validation
// before a multi-table write.
export class OrderBuilder {
  static build(input: CreateOrderInput, comboSnapshots: ComboSnapshot[]): BuiltOrder {
    if (input.items.length === 0) {
      throw new Error("Giỏ hàng đang trống.");
    }
    if (
      input.fulfillmentType === "delivery" &&
      (!input.deliveryAddressLine || input.deliveryLat === undefined || input.deliveryLng === undefined)
    ) {
      throw new Error("Vui lòng nhập địa chỉ giao hàng.");
    }

    const snapshotById = new Map(comboSnapshots.map((c) => [c.id, c]));
    const now = new Date();
    let subtotal = 0;

    const items = input.items.map(({ comboId, quantity }) => {
      const combo = snapshotById.get(comboId);
      if (!combo) {
        throw new Error("Một combo trong giỏ hàng không còn tồn tại.");
      }
      if (combo.storeId !== input.storeId) {
        throw new Error("Giỏ hàng chỉ được chứa combo từ một cửa hàng.");
      }
      // Defense-in-depth per .claude/rules/business-rules.md: best-before
      // and status are re-checked here even though the public listing query
      // already filters on them — never trust a cart built minutes ago.
      if (combo.status !== "active") {
        throw new Error(`"${combo.name}" hiện không còn bán.`);
      }
      if (new Date(combo.bestBefore) <= now) {
        throw new Error(`"${combo.name}" đã quá hạn Best Before.`);
      }
      if (combo.remainingStock < quantity) {
        throw new Error(
          `"${combo.name}" chỉ còn ${combo.remainingStock} phần, không đủ số lượng bạn chọn.`
        );
      }
      if (input.fulfillmentType === "delivery" && !combo.deliverySupported) {
        throw new Error(`"${combo.name}" không hỗ trợ giao hàng.`);
      }
      if (input.fulfillmentType === "pickup" && !combo.pickupSupported) {
        throw new Error(`"${combo.name}" không hỗ trợ tự đến lấy.`);
      }

      const lineSubtotal = combo.currentPrice * quantity;
      subtotal += lineSubtotal;

      return {
        combo_id: comboId,
        quantity,
        unit_price_at_purchase: combo.currentPrice,
        subtotal: lineSubtotal,
        remainingStockBeforeOrder: combo.remainingStock,
      };
    });

    return {
      order: {
        customer_id: input.customerId,
        store_id: input.storeId,
        fulfillment_type: input.fulfillmentType,
        subtotal,
        // Bulk-buy discount is Phase 4 (bulk_discount_tiers table dormant
        // until then) — stays 0 here, not hardcoded logic to remove later.
        discount_amount: 0,
        bulk_discount_pct: 0,
        total_amount: subtotal,
      },
      items,
      delivery:
        input.fulfillmentType === "delivery"
          ? {
              addressLine: input.deliveryAddressLine!,
              lat: input.deliveryLat!,
              lng: input.deliveryLng!,
            }
          : undefined,
    };
  }
}
