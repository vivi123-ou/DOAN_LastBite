"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { registerStoreSchema, updateStoreSchema, bankAccountSchema } from "@/lib/validation/store.schema";
import { parseOrThrow } from "@/lib/validation/parse";
import {
  getStoreByOwnerId,
  registerStore,
  updateStore,
  upsertBankAccount,
} from "@/lib/repositories/store.repository";
import { getById as getProfileById } from "@/lib/repositories/profile.repository";

export async function registerStoreAction(input: unknown) {
  const parsed = parseOrThrow(registerStoreSchema, input);

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập trước.");

  // role='admin' is a "pure staff" account per explicit product decision —
  // no shopping, no store ownership. The primary gate is hiding "Cửa hàng
  // của tôi" from the menu (site-menu.tsx) for that role; this is
  // defense-in-depth in case the form is reached/submitted directly.
  const profile = await getProfileById(supabase, userId);
  if (profile?.role === "admin") {
    throw new Error("Tài khoản quản trị không thể đăng ký cửa hàng.");
  }

  await registerStore(supabase, userId, parsed);
  revalidatePath("/dashboard");
}

export async function updateStoreAction(input: unknown) {
  const parsed = parseOrThrow(updateStoreSchema, input);

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập trước.");

  const store = await getStoreByOwnerId(supabase, userId);
  if (!store) throw new Error("Bạn chưa có cửa hàng.");

  await updateStore(supabase, store.id, parsed);
  revalidatePath("/dashboard/store");
  revalidatePath("/dashboard");
}

// Separate action (not folded into updateStoreAction) since it writes to a
// different table (store_bank_accounts, 0030) with its own RLS — same
// "genuinely separate concern, separate submit" reasoning already used for
// e.g. the plan-payment vs. store-info forms.
export async function updateBankAccountAction(input: unknown) {
  const parsed = parseOrThrow(bankAccountSchema, input);

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập trước.");

  const store = await getStoreByOwnerId(supabase, userId);
  if (!store) throw new Error("Bạn chưa có cửa hàng.");

  await upsertBankAccount(supabase, store.id, parsed);
  revalidatePath("/dashboard/store");
}
