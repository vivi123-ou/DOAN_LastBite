"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { registerStoreSchema } from "@/lib/validation/store.schema";
import { registerStore } from "@/lib/repositories/store.repository";

export async function registerStoreAction(input: unknown) {
  const parsed = registerStoreSchema.parse(input);

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập trước.");

  await registerStore(supabase, userId, parsed);
  revalidatePath("/dashboard");
}
