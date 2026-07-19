import { ALLOWED_CATEGORY_SLUGS, type Category } from "@/lib/domain/category";
import type { CreateComboInput } from "@/lib/domain/combo";
import { suggestBestBefore } from "@/lib/pricing/lock-duration/lock-duration.policy";

export interface BuiltCombo {
  combo: {
    store_id: string;
    category_id: string;
    name: string;
    description: string | null;
    original_price: number;
    current_price: number;
    initial_stock: number;
    remaining_stock: number;
    best_before: string;
    delivery_supported: boolean;
    pickup_supported: boolean;
  };
  items: { item_name: string; item_description: string | null; quantity: number }[];
  imageUrls: string[];
}

// Assembles a valid combo before a single multi-table write (see
// combo.repository.ts create()). Enforces the category whitelist and
// computes the default Best Before — see .claude/rules/business-rules.md.
export class ComboBuilder {
  static build(input: CreateComboInput, category: Category): BuiltCombo {
    if (!ALLOWED_CATEGORY_SLUGS.includes(category.slug as (typeof ALLOWED_CATEGORY_SLUGS)[number])) {
      throw new Error(
        `Category "${category.slug}" is not allowed for combos — only drinks, snacks/desserts, and cooked/prepared food may be listed.`
      );
    }
    if (input.items.length === 0) {
      throw new Error("A combo must contain at least one item.");
    }

    const bestBefore = input.bestBeforeOverride ?? suggestBestBefore(category);

    return {
      combo: {
        store_id: input.storeId,
        category_id: input.categoryId,
        name: input.name,
        description: input.description ?? null,
        original_price: input.originalPrice,
        current_price: input.originalPrice,
        initial_stock: input.initialStock,
        remaining_stock: input.initialStock,
        best_before: bestBefore.toISOString(),
        delivery_supported: input.deliverySupported,
        pickup_supported: input.pickupSupported,
      },
      items: input.items.map((item) => ({
        item_name: item.itemName,
        item_description: item.itemDescription ?? null,
        quantity: item.quantity,
      })),
      imageUrls: input.imageUrls,
    };
  }
}
