"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { createComboSchema } from "@/lib/validation/combo.schema";
import { parseOrThrow } from "@/lib/validation/parse";
import { getCategoryById } from "@/lib/repositories/category.repository";
import { getStoreByOwnerId } from "@/lib/repositories/store.repository";
import { getEffectiveSubscription } from "@/lib/repositories/subscription.repository";
import { ComboBuilder } from "@/lib/factories/combo.builder";
import * as comboRepository from "@/lib/repositories/combo.repository";

async function buildComboForCurrentStore(input: unknown) {
  const parsed = parseOrThrow(createComboSchema, input);

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập trước.");

  // Independent lookups — run concurrently instead of two sequential
  // round trips to Supabase.
  const [store, category] = await Promise.all([
    getStoreByOwnerId(supabase, userId),
    getCategoryById(supabase, parsed.categoryId),
  ]);
  if (!store) throw new Error("Bạn cần đăng ký cửa hàng trước khi tạo combo.");
  if (!category) throw new Error("Loại combo không hợp lệ.");

  const built = ComboBuilder.build(
    {
      storeId: store.id,
      categoryId: parsed.categoryId,
      name: parsed.name,
      description: parsed.description,
      originalPrice: parsed.originalPrice,
      initialStock: parsed.initialStock,
      bestBeforeOverride: parsed.bestBeforeOverride ? new Date(parsed.bestBeforeOverride) : undefined,
      maxDiscountPct: parsed.maxDiscountPct,
      deliverySupported: parsed.deliverySupported,
      pickupSupported: parsed.pickupSupported,
      items: parsed.items,
      imageUrls: parsed.imageUrls,
    },
    category
  );

  return { supabase, store, built };
}

// Subscription gate — only for genuinely NEW combos (this function),
// deliberately not enforced in updateComboAction below: blocking a store
// from fixing/relisting an *existing* combo just because their
// subscription lapsed felt overly punitive for this scope, versus blocking
// brand-new listings, which is what "khóa tính năng đăng combo mới" most
// directly asks for. "Bán lại" (relist) goes through updateComboAction, so
// it stays available even while locked — a store can still sell through
// what they've already listed, they just can't add more.
export async function createComboAction(input: unknown) {
  const { supabase, store, built } = await buildComboForCurrentStore(input);

  const admin = createAdminClient();
  const effective = await getEffectiveSubscription(admin, store.id);
  if (effective.locked) {
    throw new Error(
      'Gói dịch vụ của cửa hàng đã hết hạn — vui lòng gia hạn ở mục "Gói dịch vụ" để tiếp tục đăng combo mới.'
    );
  }
  if (effective.maxActiveCombos !== null) {
    const { count, error } = await supabase
      .from("combos")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id)
      .eq("status", "active");
    if (error) throw error;
    if ((count ?? 0) >= effective.maxActiveCombos) {
      throw new Error(
        `Cửa hàng đã đạt giới hạn ${effective.maxActiveCombos} combo đang bán của gói hiện tại — nâng cấp gói ở mục "Gói dịch vụ" hoặc dừng bán bớt combo cũ để đăng combo mới.`
      );
    }
  }

  await comboRepository.create(supabase, built, {
    name: store.name,
    addressLine: store.addressLine,
    ownerId: store.ownerId,
  });
  revalidatePath("/dashboard/combos");
}

export async function updateComboAction(comboId: string, input: unknown) {
  const { supabase, store, built } = await buildComboForCurrentStore(input);
  await comboRepository.update(supabase, comboId, built, {
    name: store.name,
    addressLine: store.addressLine,
    ownerId: store.ownerId,
  });
  revalidatePath("/dashboard/combos");
  revalidatePath(`/dashboard/combos/${comboId}/edit`);
}

export async function toggleComboStatusAction(
  comboId: string,
  status: "active" | "paused"
) {
  const supabase = await createClient();
  await comboRepository.updateStatus(supabase, comboId, status);
  revalidatePath("/dashboard/combos");
}
