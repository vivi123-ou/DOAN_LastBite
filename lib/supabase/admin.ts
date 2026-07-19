import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// Service-role client — bypasses RLS entirely. Never import this from a
// Client Component or expose SUPABASE_SERVICE_ROLE_KEY to the browser.
// Reserved for: payment webhook/IPN handlers, store verification approval,
// and other admin-only mutations described in .claude/rules/database-and-schema.md.
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
