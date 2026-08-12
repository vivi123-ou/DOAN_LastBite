"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { updateProfileSchema } from "@/lib/validation/profile.schema";
import { update } from "@/lib/repositories/profile.repository";

// Regular client — RLS profiles_update_own already scopes this to the
// caller's own row, no cross-actor concern (unlike order creation).
export async function updateProfileAction(input: unknown): Promise<void> {
  const parsed = updateProfileSchema.parse(input);

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập trước.");

  await update(supabase, userId, {
    fullName: parsed.fullName,
    phone: parsed.phone,
    avatarUrl: parsed.avatarUrl,
  });
  revalidatePath("/account");
}
