import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Profile, UpdateProfileInput } from "@/lib/domain/profile";

export async function getById(
  client: SupabaseClient<Database>,
  userId: string
): Promise<Profile | null> {
  const { data, error } = await client
    .from("profiles")
    .select("id, role, full_name, phone, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    role: data.role,
    fullName: data.full_name,
    phone: data.phone,
    avatarUrl: data.avatar_url,
  };
}

// RLS profiles_update_own (0001_init_schema.sql) already scopes this to the
// caller's own row — no cross-actor concern here, unlike order creation.
export async function update(
  client: SupabaseClient<Database>,
  userId: string,
  input: UpdateProfileInput
): Promise<void> {
  const { error } = await client
    .from("profiles")
    .update({
      ...(input.fullName !== undefined && { full_name: input.fullName }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.avatarUrl !== undefined && { avatar_url: input.avatarUrl }),
    })
    .eq("id", userId);
  if (error) throw error;
}
