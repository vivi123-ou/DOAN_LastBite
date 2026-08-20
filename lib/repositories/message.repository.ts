import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Message } from "@/lib/domain/social";

function map(row: Database["public"]["Tables"]["messages"]["Row"]): Message {
  return {
    id: row.id,
    friendshipId: row.friendship_id,
    senderId: row.sender_id,
    body: row.body,
    groupOrderId: row.group_order_id,
    createdAt: row.created_at,
  };
}

// messages_select_thread RLS (0010) already scopes this to the two parties
// of the friendship — regular client.
export async function listForFriendship(
  client: SupabaseClient<Database>,
  friendshipId: string,
  limit = 50
): Promise<Message[]> {
  const { data, error } = await client
    .from("messages")
    .select("*")
    .eq("friendship_id", friendshipId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data.map(map);
}

// Upserts the caller's own "last read" watermark for a thread (0024) —
// called once when the chat page is opened, not per-message. friendship_reads
// has no unique constraint besides its own (friendship_id, user_id) primary
// key, so a plain upsert both creates the first-ever read and bumps every
// later one.
export async function markRead(
  client: SupabaseClient<Database>,
  friendshipId: string,
  userId: string
): Promise<void> {
  const { error } = await client
    .from("friendship_reads")
    .upsert({ friendship_id: friendshipId, user_id: userId, last_read_at: new Date().toISOString() });
  if (error) throw error;
}

// Messenger-style unread badge for /friends — unread_message_counts() (0024)
// already scopes everything to the caller's own threads via RLS (it takes
// no user_id argument, always auth.uid()), so this is just a thin wrapper.
// Number(...) because Postgres bigint aggregates can come back as a string
// over PostgREST depending on config — never assume it's already a number.
export async function getUnreadCounts(client: SupabaseClient<Database>): Promise<Map<string, number>> {
  const { data, error } = await client.rpc("unread_message_counts");
  if (error) throw error;
  return new Map(data.map((row) => [row.friendship_id, Number(row.unread_count)]));
}

// messages_insert_own RLS requires sender_id = auth.uid() and an accepted
// friendship — same-actor write, regular client.
export async function send(
  client: SupabaseClient<Database>,
  input: { friendshipId: string; senderId: string; body: string; groupOrderId?: string | null }
): Promise<Message> {
  const { data, error } = await client
    .from("messages")
    .insert({
      friendship_id: input.friendshipId,
      sender_id: input.senderId,
      body: input.body,
      group_order_id: input.groupOrderId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return map(data);
}
