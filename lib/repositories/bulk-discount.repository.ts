import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { BulkDiscountTier } from "@/lib/domain/store";

// bulk_discount_tiers_select_all RLS (0001) is public (`using (true)`) —
// this table has always been readable by anyone, it just never had a
// caller until the group-buy checkout round. Regular client works fine
// here, no cross-actor concern.
//
// Store-specific tiers take precedence over the platform-wide default
// (store_id is null) whenever the store has configured any of its own —
// there's still no store-dashboard UI to create those yet (see CLAUDE.md's
// "Phase 4 remaining work"), so in practice every store resolves to the
// platform default seeded by 0021_bulk_discount_default_tiers.sql today.
export async function listTiersForStore(
  client: SupabaseClient<Database>,
  storeId: string
): Promise<BulkDiscountTier[]> {
  const { data: storeTiers, error } = await client
    .from("bulk_discount_tiers")
    .select("id, store_id, min_quantity, discount_pct")
    .eq("store_id", storeId)
    .order("min_quantity");
  if (error) throw error;
  if (storeTiers.length > 0) return storeTiers.map(mapTier);

  const { data: defaultTiers, error: defaultError } = await client
    .from("bulk_discount_tiers")
    .select("id, store_id, min_quantity, discount_pct")
    .is("store_id", null)
    .order("min_quantity");
  if (defaultError) throw defaultError;
  return defaultTiers.map(mapTier);
}

function mapTier(row: {
  id: string;
  store_id: string | null;
  min_quantity: number;
  discount_pct: number;
}): BulkDiscountTier {
  return {
    id: row.id,
    storeId: row.store_id,
    minQuantity: row.min_quantity,
    discountPct: row.discount_pct,
  };
}

// Pure function, no I/O — the highest tier `quantity` actually qualifies
// for (`current`), and the next tier still out of reach (`next`), used both
// for the group-order invite card's progress messaging and (via
// listTiersForStore + this) for resolving the discount actually charged at
// checkout time (cart/actions.ts).
export function resolveTier(
  tiers: BulkDiscountTier[],
  quantity: number
): { current: BulkDiscountTier | null; next: BulkDiscountTier | null } {
  const sorted = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);
  let current: BulkDiscountTier | null = null;
  let next: BulkDiscountTier | null = null;
  for (const tier of sorted) {
    if (quantity >= tier.minQuantity) {
      current = tier;
    } else {
      next = tier;
      break;
    }
  }
  return { current, next };
}
