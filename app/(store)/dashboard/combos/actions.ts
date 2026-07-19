"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { createComboSchema } from "@/lib/validation/combo.schema";
import { getCategoryById } from "@/lib/repositories/category.repository";
import { getStoreByOwnerId } from "@/lib/repositories/store.repository";
import { ComboBuilder } from "@/lib/factories/combo.builder";
import * as comboRepository from "@/lib/repositories/combo.repository";

async function buildComboForCurrentStore(input: unknown) {
  const parsed = createComboSchema.parse(input);

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập trước.");

  const store = await getStoreByOwnerId(supabase, userId);
  if (!store) throw new Error("Bạn cần đăng ký cửa hàng trước khi tạo combo.");

  const category = await getCategoryById(supabase, parsed.categoryId);
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
      deliverySupported: parsed.deliverySupported,
      pickupSupported: parsed.pickupSupported,
      items: parsed.items,
      imageUrls: parsed.imageUrls,
    },
    category
  );

  return { supabase, store, built };
}

export async function createComboAction(input: unknown) {
  const { supabase, built } = await buildComboForCurrentStore(input);
  await comboRepository.create(supabase, built);
  revalidatePath("/dashboard/combos");
}

export async function updateComboAction(comboId: string, input: unknown) {
  const { supabase, built } = await buildComboForCurrentStore(input);
  await comboRepository.update(supabase, comboId, built);
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
