import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// getClaims() verifies the JWT locally against the cached JWKS and is
// preferred over getUser(), which always round-trips to the Auth server —
// see @supabase/ssr's README "Known patterns" section.
export async function getCurrentUserId(
  client: SupabaseClient<Database>
): Promise<string | null> {
  const { data } = await client.auth.getClaims();
  return (data?.claims.sub as string | undefined) ?? null;
}
