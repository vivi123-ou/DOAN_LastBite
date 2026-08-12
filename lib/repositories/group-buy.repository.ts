import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { GroupOrderInvite } from "@/lib/domain/social";

// group_orders' own RLS (group_orders_all_initiator) would actually let the
// initiator create their own row with the regular client, but
// group_order_participants has *zero* client-facing INSERT policy at all
// (0001's comment: "route via service role, not a raw client insert
// policy, to avoid leaking enumeration of other users' group orders") —
// since creating a group-buy invite always immediately auto-joins the
// initiator as a participant, the whole flow uses the service-role client
// throughout rather than splitting it across two client types.
export async function create(
  adminClient: SupabaseClient<Database>,
  input: { initiatorId: string; storeId: string; deadline: string }
): Promise<{ id: string; inviteCode: string }> {
  const inviteCode = crypto.randomUUID().slice(0, 8);

  const { data: groupOrder, error } = await adminClient
    .from("group_orders")
    .insert({
      initiator_id: input.initiatorId,
      store_id: input.storeId,
      invite_code: inviteCode,
      deadline: input.deadline,
    })
    .select("id, invite_code")
    .single();
  if (error) throw error;

  const { error: joinError } = await adminClient
    .from("group_order_participants")
    .insert({ group_order_id: groupOrder.id, user_id: input.initiatorId });
  if (joinError) throw joinError;

  return { id: groupOrder.id, inviteCode: groupOrder.invite_code };
}

// Postgres unique_violation — the viewer already joined this group order.
// Not an error from the UI's point of view: "Tham gia" on an invite you've
// already accepted should just no-op, not show a failure toast.
const UNIQUE_VIOLATION = "23505";

export async function join(
  adminClient: SupabaseClient<Database>,
  groupOrderId: string,
  userId: string
): Promise<void> {
  const { error } = await adminClient
    .from("group_order_participants")
    .insert({ group_order_id: groupOrderId, user_id: userId });
  if (error && error.code !== UNIQUE_VIOLATION) throw error;
}

// Renders the invite card inside a chat message (chat-view.tsx) — the
// recipient hasn't joined yet, so group_orders_select_participant RLS
// wouldn't let their own client session read this row. Server-side only,
// via a server action that calls this with the admin client, returning
// just the minimal safe fields a card needs.
export async function getInvite(
  adminClient: SupabaseClient<Database>,
  groupOrderId: string,
  viewerId: string
): Promise<GroupOrderInvite | null> {
  const { data: row, error } = await adminClient
    .from("group_orders")
    .select("id, store_id, deadline, status")
    .eq("id", groupOrderId)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const [{ data: store }, { count }, { data: viewerRow }] = await Promise.all([
    adminClient.from("stores").select("name").eq("id", row.store_id).maybeSingle(),
    adminClient
      .from("group_order_participants")
      .select("id", { count: "exact", head: true })
      .eq("group_order_id", row.id),
    adminClient
      .from("group_order_participants")
      .select("id")
      .eq("group_order_id", row.id)
      .eq("user_id", viewerId)
      .maybeSingle(),
  ]);

  return {
    groupOrderId: row.id,
    storeId: row.store_id,
    storeName: store?.name ?? "Cửa hàng",
    deadline: row.deadline,
    status: row.status,
    participantCount: count ?? 0,
    isViewerParticipant: Boolean(viewerRow),
  };
}
