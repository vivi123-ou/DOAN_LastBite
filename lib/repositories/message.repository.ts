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
