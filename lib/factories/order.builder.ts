import type { ComboSnapshot } from "@/lib/domain/combo";
import type { CreateOrderInput } from "@/lib/domain/order";
import { calculateRedemptionValue, VND_PER_POINT } from "@/lib/pricing/net-zero/net-zero.policy";

export interface BuiltOrder {
  order: {
    customer_id: string;
    store_id: string;
    fulfillment_type: "pickup" | "delivery";
    subtotal: number;
    discount_amount: number;
    bulk_discount_pct: number;
    group_order_id: string | null;
    net_zero_points_used: number;
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

    // Bulk-buy (group order) discount — bulkDiscountPct is the caller's
    // fresh-fetched resolution (cart/actions.ts, via group-buy.repository.ts's
    // resolveCheckoutDiscount(), from the group's live total quantity
    // against bulk_discount_tiers), never trusted from the client. Applied
    // *before* Net Zero points, not after — points then discount whatever's
    // actually left to pay, not the pre-bulk-discount subtotal.
    const bulkDiscountPct = Math.max(0, Math.min(100, input.bulkDiscountPct ?? 0));
    const bulkDiscountAmount = Math.round((subtotal * bulkDiscountPct) / 100);
    const subtotalAfterBulkDiscount = subtotal - bulkDiscountAmount;

    // Net Zero points redemption — availableNetZeroPoints is the caller's
    // fresh-fetched balance (cart/actions.ts), never trusted from the
    // client, same rule as combo prices/stock above. Capped so a discount
    // can never exceed what's left to pay after the bulk discount: redeeming
    // more points than that would mean *paying* the customer, not
    // discounting them.
    const pointsRequested = Math.max(0, Math.floor(input.netZeroPointsToApply ?? 0));
    const availablePoints = Math.max(0, input.availableNetZeroPoints ?? 0);
    if (pointsRequested > availablePoints) {
      throw new Error("Bạn không có đủ điểm Net Zero.");
    }
    let netZeroPointsUsed = pointsRequested;
    let pointsDiscount = calculateRedemptionValue(pointsRequested);
    if (pointsDiscount > subtotalAfterBulkDiscount) {
      netZeroPointsUsed = Math.floor(subtotalAfterBulkDiscount / VND_PER_POINT);
      pointsDiscount = calculateRedemptionValue(netZeroPointsUsed);
    }

    const discountAmount = bulkDiscountAmount + pointsDiscount;

    return {
      order: {
        customer_id: input.customerId,
        store_id: input.storeId,
        fulfillment_type: input.fulfillmentType,
        subtotal,
        discount_amount: discountAmount,
        bulk_discount_pct: bulkDiscountPct,
        group_order_id: input.groupOrderId ?? null,
        net_zero_points_used: netZeroPointsUsed,
        total_amount: subtotal - discountAmount,
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
