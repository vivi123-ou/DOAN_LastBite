import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// Regular client — search_history_insert_own RLS (0001_init_schema.sql)
// already scopes this to the caller's own rows, no cross-actor concern.
// Fire-and-forget from the client after a search returns results (see
// nearby-combos-section.tsx); failures here shouldn't block showing results.
export async function record(
  client: SupabaseClient<Database>,
  userId: string,
  queryText: string
): Promise<void> {
  const trimmed = queryText.trim();
  if (!trimmed) return;

  const { error } = await client.from("search_history").insert({
    user_id: userId,
    query_text: trimmed,
  });
  if (error) throw error;
}
