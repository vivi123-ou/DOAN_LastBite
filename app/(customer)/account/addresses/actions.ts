"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { create, remove, setDefault, update } from "@/lib/repositories/address.repository";
import { parseOrThrow } from "@/lib/validation/parse";
import { saveAddressSchema } from "@/lib/validation/address.schema";

export async function createAddressAction(input: unknown) {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập trước.");

  const parsed = parseOrThrow(saveAddressSchema, input);
  await create(supabase, userId, parsed);
  revalidatePath("/account/addresses");
}

export async function updateAddressAction(addressId: string, input: unknown) {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập trước.");

  const parsed = parseOrThrow(saveAddressSchema, input);
  await update(supabase, addressId, parsed);
  revalidatePath("/account/addresses");
}

export async function deleteAddressAction(addressId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập trước.");

  await remove(supabase, addressId);
  revalidatePath("/account/addresses");
}

export async function setDefaultAddressAction(addressId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập trước.");

  await setDefault(supabase, userId, addressId);
  revalidatePath("/account/addresses");
}
