import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Category } from "@/lib/domain/category";

function toDomain(row: Database["public"]["Tables"]["categories"]["Row"]): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    defaultLockDurationMinutes: row.default_lock_duration_minutes,
  };
}

export async function listCategories(
  client: SupabaseClient<Database>
): Promise<Category[]> {
  const { data, error } = await client.from("categories").select("*").order("name");
  if (error) throw error;
  return data.map(toDomain);
}

export async function getCategoryById(
  client: SupabaseClient<Database>,
  id: string
): Promise<Category | null> {
  const { data, error } = await client.from("categories").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toDomain(data) : null;
}
