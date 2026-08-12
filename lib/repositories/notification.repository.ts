import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.types";
import type { Notification } from "@/lib/domain/notification";

function map(row: Database["public"]["Tables"]["notifications"]["Row"]): Notification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    payload: (row.payload as Record<string, unknown> | null) ?? null,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

// notifications_select_own / notifications_update_own RLS (0001) already
// scope these two to the signed-in user's own rows — regular client.
export async function listForUser(
  client: SupabaseClient<Database>,
  userId: string,
  limit = 20
): Promise<Notification[]> {
  const { data, error } = await client
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map(map);
}

export async function countUnread(
  client: SupabaseClient<Database>,
  userId: string
): Promise<number> {
  const { count, error } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) throw error;
  return count ?? 0;
}

export async function markAllRead(
  client: SupabaseClient<Database>,
  userId: string
): Promise<void> {
  const { error } = await client
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) throw error;
}

// Notifications have zero client-facing INSERT policy (0001 — "written by
// server/trigger code, not directly by clients"), same posture as
// `payments`. Every notification is created *about* one user *by* an
// action some other actor took (a store updating order status, a friend
// request, a new message) — always cross-actor, so this always needs the
// service-role client, never the acting user's own session.
export async function create(
  adminClient: SupabaseClient<Database>,
  input: { userId: string; type: string; title: string; body?: string; payload?: Record<string, unknown> }
): Promise<void> {
  const { error } = await adminClient.from("notifications").insert({
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    // Callers always pass plain JSON-serializable values (ids/strings) —
    // Record<string, unknown> isn't structurally a Json subtype, so this
    // is an intentional, safe-in-practice cast rather than a type hole.
    payload: (input.payload as Json | undefined) ?? null,
  });
  if (error) throw error;
}
