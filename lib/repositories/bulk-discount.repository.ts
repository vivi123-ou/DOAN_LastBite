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
// /dashboard/pricing lets a store owner do that (see createTier/updateTier/
// deleteTier below); a store that never bothers configuring anything just
// keeps resolving to the platform default seeded by
// 0021_bulk_discount_default_tiers.sql, same as before.
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

// The store's own configured tiers only — never falls back to the platform
// default, unlike listTiersForStore() above. Backs the new
// /dashboard/pricing config page, which needs to show "you have none yet"
// distinctly from "here's what you've set", not the resolved-for-checkout
// value.
export async function listOwnTiers(
  client: SupabaseClient<Database>,
  storeId: string
): Promise<BulkDiscountTier[]> {
  const { data, error } = await client
    .from("bulk_discount_tiers")
    .select("id, store_id, min_quantity, discount_pct")
    .eq("store_id", storeId)
    .order("min_quantity");
  if (error) throw error;
  return data.map(mapTier);
}

export async function listPlatformDefaultTiers(
  client: SupabaseClient<Database>
): Promise<BulkDiscountTier[]> {
  const { data, error } = await client
    .from("bulk_discount_tiers")
    .select("id, store_id, min_quantity, discount_pct")
    .is("store_id", null)
    .order("min_quantity");
  if (error) throw error;
  return data.map(mapTier);
}

// bulk_discount_tiers_all_owner RLS (0001) already scopes insert/update/
// delete to `store_id`s the caller actually owns (and structurally can't
// ever touch the store_id IS NULL platform-default rows — its `with check`
// requires a real ownership join) — regular client, no admin escalation
// needed for any of the three writes below.
export async function createTier(
  client: SupabaseClient<Database>,
  storeId: string,
  input: { minQuantity: number; discountPct: number }
): Promise<void> {
  const { error } = await client
    .from("bulk_discount_tiers")
    .insert({ store_id: storeId, min_quantity: input.minQuantity, discount_pct: input.discountPct });
  if (error) throw error;
}

export async function updateTier(
  client: SupabaseClient<Database>,
  tierId: string,
  input: { minQuantity: number; discountPct: number }
): Promise<void> {
  const { error } = await client
    .from("bulk_discount_tiers")
    .update({ min_quantity: input.minQuantity, discount_pct: input.discountPct })
    .eq("id", tierId);
  if (error) throw error;
}

export async function deleteTier(client: SupabaseClient<Database>, tierId: string): Promise<void> {
  const { error } = await client.from("bulk_discount_tiers").delete().eq("id", tierId);
  if (error) throw error;
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
