"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { registerStoreSchema, updateStoreSchema } from "@/lib/validation/store.schema";
import { getStoreByOwnerId, registerStore, updateStore } from "@/lib/repositories/store.repository";

export async function registerStoreAction(input: unknown) {
  const parsed = registerStoreSchema.parse(input);

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập trước.");

  await registerStore(supabase, userId, parsed);
  revalidatePath("/dashboard");
}

export async function updateStoreAction(input: unknown) {
  const parsed = updateStoreSchema.parse(input);

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập trước.");

  const store = await getStoreByOwnerId(supabase, userId);
  if (!store) throw new Error("Bạn chưa có cửa hàng.");

  await updateStore(supabase, store.id, parsed);
  revalidatePath("/dashboard/store");
  revalidatePath("/dashboard");
}
