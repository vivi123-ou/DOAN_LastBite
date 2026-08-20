import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { FriendSummary, FriendshipStatus, PublicProfile } from "@/lib/domain/social";

type FriendshipRow = Database["public"]["Tables"]["friendships"]["Row"];

// profiles has no general "search all users" client policy on purpose
// (deliberately narrow — see 0010_friends_messages.sql's comment), so this
// goes through the service-role client and returns only the minimal public
// fields a friend search actually needs, never email/phone. Backed by
// search_profiles() (0010) rather than a raw .ilike() so the trigram index
// on lower(f_unaccent(full_name)) is actually used — same rule
// database-and-schema.md already applies to combo/store name search.
export async function searchUsers(
  adminClient: SupabaseClient<Database>,
  query: string,
  excludeUserId: string,
  limit = 10
): Promise<PublicProfile[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data, error } = await adminClient.rpc("search_profiles", {
    in_query: trimmed,
    exclude_user_id: excludeUserId,
    max_results: limit,
  });
  if (error) throw error;

  return data.map((row) => ({
    userId: row.user_id,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
  }));
}

// friendships_select_own RLS (0010) already scopes this to rows where the
// caller is requester or addressee — a non-party's own client session gets
// null here regardless (RLS), so callers can treat null as "not found or
// not yours" without a separate authorization check.
export async function getById(
  client: SupabaseClient<Database>,
  friendshipId: string
): Promise<FriendshipRow | null> {
  const { data, error } = await client.from("friendships").select("*").eq("id", friendshipId).maybeSingle();
  if (error) throw error;
  return data;
}

// friendships_select_own RLS (0010) already scopes this to rows where the
// caller is requester or addressee — regular client.
export async function getFriendshipBetween(
  client: SupabaseClient<Database>,
  userA: string,
  userB: string
): Promise<FriendshipRow | null> {
  const { data, error } = await client
    .from("friendships")
    .select("*")
    .or(
      `and(requester_id.eq.${userA},addressee_id.eq.${userB}),and(requester_id.eq.${userB},addressee_id.eq.${userA})`
    )
    .maybeSingle();
  if (error) throw error;
  return data;
}

// friendships_insert_own RLS requires requester_id = auth.uid() — same-
// actor write, regular client.
export async function sendRequest(
  client: SupabaseClient<Database>,
  requesterId: string,
  addresseeId: string
): Promise<FriendshipRow> {
  const { data, error } = await client
    .from("friendships")
    .insert({ requester_id: requesterId, addressee_id: addresseeId })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// friendships_update_addressee RLS requires addressee_id = auth.uid() —
// same-actor write (the addressee responding to their own pending
// request), regular client.
export async function respondToRequest(
  client: SupabaseClient<Database>,
  friendshipId: string,
  accept: boolean
): Promise<FriendshipRow> {
  const { data, error } = await client
    .from("friendships")
    .update({ status: accept ? "accepted" : "rejected", responded_at: new Date().toISOString() })
    .eq("id", friendshipId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// `adminClient` is required, not optional: profiles_select_own (0001) only
// lets a user read *their own* row, and there's no RLS policy letting two
// friends read each other's profile (deliberately — see 0010's own comment
// on why profiles' policies stay narrow and search goes through the
// service-role client instead of a new policy). Without this, every "other
// party" profile in this list came back null under RLS and silently fell
// back to "Người dùng LastBite" with no avatar — reported live as friend
// requests/friends showing up with a missing name and avatar. The
// friendship rows themselves still come from the regular `client` — that
// part is a genuine same-actor read, friendships_select_own already scopes
// it correctly.
// Covers both "cancel my own pending outgoing request" and "unfriend an
// accepted friendship" — friendships_delete_own RLS (0018) already scopes
// this to rows where the caller is requester or addressee, regardless of
// status, so no separate status check is needed here (same "RLS already
// scopes it correctly" simplicity as updateStatus() elsewhere in this
// codebase). Regular client — same-actor write.
export async function remove(client: SupabaseClient<Database>, friendshipId: string): Promise<void> {
  const { error } = await client.from("friendships").delete().eq("id", friendshipId);
  if (error) throw error;
}

export async function listFriendships(
  client: SupabaseClient<Database>,
  adminClient: SupabaseClient<Database>,
  userId: string
): Promise<FriendSummary[]> {
  const { data: rows, error } = await client
    .from("friendships")
    .select("*")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (rows.length === 0) return [];

  const otherIds = rows.map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id));
  const { data: profiles, error: profilesError } = await adminClient
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", otherIds);
  if (profilesError) throw profilesError;

  const profileById = new Map(profiles.map((p) => [p.id, p]));

  return rows.map((row) => {
    const otherId = row.requester_id === userId ? row.addressee_id : row.requester_id;
    const other = profileById.get(otherId);
    return {
      friendshipId: row.id,
      userId: otherId,
      fullName: other?.full_name ?? null,
      avatarUrl: other?.avatar_url ?? null,
      status: row.status as FriendshipStatus,
      isIncomingRequest: row.status === "pending" && row.addressee_id === userId,
    };
  });
}
