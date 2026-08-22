"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getStoreByOwnerId } from "@/lib/repositories/store.repository";
import { createTier, updateTier, deleteTier } from "@/lib/repositories/bulk-discount.repository";
import { parseOrThrow } from "@/lib/validation/parse";
import { bulkDiscountTierSchema } from "@/lib/validation/bulk-discount.schema";

// Same "require own store" shape as every other store-scoped action file —
// bulk_discount_tiers_all_owner RLS (0001) already scopes the actual writes
// below to this store's own rows, but the action still needs a real
// storeId to insert against, and a clear error if there's no store yet.
async function requireOwnStore() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập trước.");
  const store = await getStoreByOwnerId(supabase, userId);
  if (!store) throw new Error("Bạn cần đăng ký cửa hàng trước.");
  return { supabase, store };
}

export async function createTierAction(input: unknown) {
  const { supabase, store } = await requireOwnStore();
  const parsed = parseOrThrow(bulkDiscountTierSchema, input);
  await createTier(supabase, store.id, parsed);
  revalidatePath("/dashboard/pricing");
}

export async function updateTierAction(tierId: string, input: unknown) {
  const { supabase } = await requireOwnStore();
  const parsed = parseOrThrow(bulkDiscountTierSchema, input);
  await updateTier(supabase, tierId, parsed);
  revalidatePath("/dashboard/pricing");
}

export async function deleteTierAction(tierId: string) {
  const { supabase } = await requireOwnStore();
  await deleteTier(supabase, tierId);
  revalidatePath("/dashboard/pricing");
}
