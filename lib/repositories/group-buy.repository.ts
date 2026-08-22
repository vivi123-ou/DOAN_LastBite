import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { GroupOrderInvite, GroupOrderParticipant } from "@/lib/domain/social";
import { listTiersForStore, resolveTier } from "@/lib/repositories/bulk-discount.repository";

type GroupOrderStatus = Database["public"]["Tables"]["group_orders"]["Row"]["status"];

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
  input: { initiatorId: string; storeId: string; comboId: string; deadline: string; quantity?: number }
): Promise<{ id: string; inviteCode: string }> {
  const inviteCode = crypto.randomUUID().slice(0, 8);

  const { data: groupOrder, error } = await adminClient
    .from("group_orders")
    .insert({
      initiator_id: input.initiatorId,
      store_id: input.storeId,
      combo_id: input.comboId,
      invite_code: inviteCode,
      deadline: input.deadline,
    })
    .select("id, invite_code")
    .single();
  if (error) throw error;

  const { error: joinError } = await adminClient
    .from("group_order_participants")
    .insert({
      group_order_id: groupOrder.id,
      user_id: input.initiatorId,
      quantity: input.quantity ?? 1,
    });
  if (joinError) throw joinError;

  return { id: groupOrder.id, inviteCode: groupOrder.invite_code };
}

// Upsert, not insert: a participant re-opening the invite and picking a
// different quantity should update their existing row (unique(group_order_id,
// user_id), 0010), not error or duplicate. "Tham gia" doubles as "đổi số
// lượng" for this reason — no separate edit flow needed.
export async function join(
  adminClient: SupabaseClient<Database>,
  groupOrderId: string,
  userId: string,
  quantity = 1
): Promise<void> {
  const { error } = await adminClient
    .from("group_order_participants")
    .upsert(
      { group_order_id: groupOrderId, user_id: userId, quantity },
      { onConflict: "group_order_id,user_id" }
    );
  if (error) throw error;
}

// Lazy sweep, same no-cron-infrastructure posture as best-before locking,
// subscription expiry, and Net Zero point expiry elsewhere in this app —
// there's no scheduled job anywhere in this codebase, so "finalize
// automatically at deadline" (business-rules.md) means "the next time
// anyone reads this group order, if its deadline has passed, the DB status
// column actually gets written to 'finalized' right then." Both read paths
// below (getInvite, resolveCheckoutDiscount) already independently treated
// a past-deadline row as unusable — this makes that real in the stored
// data too, not just in each caller's own local check.
async function sweepIfExpired(
  admin: SupabaseClient<Database>,
  row: { id: string; status: GroupOrderStatus; deadline: string }
): Promise<GroupOrderStatus> {
  if (row.status !== "open" || new Date(row.deadline) > new Date()) return row.status;
  const { error } = await admin.from("group_orders").update({ status: "finalized" }).eq("id", row.id);
  if (error) throw error;
  return "finalized";
}

// Renders the invite card inside a chat message (chat-view.tsx) — the
// recipient hasn't joined yet, so group_orders_select_participant RLS
// wouldn't let their own client session read this row. Server-side only,
// via a server action that calls this with the admin client, returning
// just the minimal safe fields a card needs — now including per-
// participant quantity and the bulk-discount tier the group's current
// total quantity qualifies for, so the card can show real progress instead
// of just a headcount.
export async function getInvite(
  adminClient: SupabaseClient<Database>,
  groupOrderId: string,
  viewerId: string
): Promise<GroupOrderInvite | null> {
  const { data: row, error } = await adminClient
    .from("group_orders")
    .select("id, store_id, combo_id, deadline, status")
    .eq("id", groupOrderId)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const status = await sweepIfExpired(adminClient, row);

  const [{ data: store }, { data: combo }, { data: participantRows }, tiers] = await Promise.all([
    adminClient.from("stores").select("name").eq("id", row.store_id).maybeSingle(),
    row.combo_id
      ? adminClient.from("combos").select("name").eq("id", row.combo_id).maybeSingle()
      : Promise.resolve({ data: null }),
    adminClient
      .from("group_order_participants")
      .select("user_id, quantity")
      .eq("group_order_id", row.id),
    listTiersForStore(adminClient, row.store_id),
  ]);

  const rows = participantRows ?? [];
  const profileById = new Map<string, { full_name: string | null; avatar_url: string | null }>();
  if (rows.length > 0) {
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in(
        "id",
        rows.map((p) => p.user_id)
      );
    for (const p of profiles ?? []) profileById.set(p.id, p);
  }

  const participants: GroupOrderParticipant[] = rows.map((p) => ({
    userId: p.user_id,
    fullName: profileById.get(p.user_id)?.full_name ?? null,
    avatarUrl: profileById.get(p.user_id)?.avatar_url ?? null,
    quantity: p.quantity,
  }));
  const totalQuantity = participants.reduce((sum, p) => sum + p.quantity, 0);
  const { current, next } = resolveTier(tiers, totalQuantity);
  const viewer = participants.find((p) => p.userId === viewerId);

  return {
    groupOrderId: row.id,
    storeId: row.store_id,
    storeName: store?.name ?? "Cửa hàng",
    comboId: row.combo_id,
    comboName: combo?.name ?? null,
    deadline: row.deadline,
    status,
    participantCount: participants.length,
    isViewerParticipant: Boolean(viewer),
    participants,
    totalQuantity,
    viewerQuantity: viewer?.quantity ?? 0,
    currentTier: current ? { minQuantity: current.minQuantity, discountPct: current.discountPct } : null,
    nextTier: next ? { minQuantity: next.minQuantity, discountPct: next.discountPct } : null,
  };
}

// Checkout-time resolution (cart/actions.ts) — never trust a client-supplied
// discount percentage, same rule as combo prices/stock/Net Zero points.
// Re-fetches the group order's own store_id (ignoring whatever storeId the
// client's cart claims) and its live total quantity fresh, so the discount
// actually charged always reflects the real, current state of the group.
export async function resolveCheckoutDiscount(
  adminClient: SupabaseClient<Database>,
  groupOrderId: string
): Promise<{ storeId: string; discountPct: number } | null> {
  const { data: row, error } = await adminClient
    .from("group_orders")
    .select("store_id, deadline, status")
    .eq("id", groupOrderId)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const status = await sweepIfExpired(adminClient, { id: groupOrderId, status: row.status, deadline: row.deadline });
  if (status !== "open") return null;

  const { data: participantRows, error: participantsError } = await adminClient
    .from("group_order_participants")
    .select("quantity")
    .eq("group_order_id", groupOrderId);
  if (participantsError) throw participantsError;

  const totalQuantity = (participantRows ?? []).reduce((sum, p) => sum + p.quantity, 0);
  const tiers = await listTiersForStore(adminClient, row.store_id);
  const { current } = resolveTier(tiers, totalQuantity);

  return { storeId: row.store_id, discountPct: current?.discountPct ?? 0 };
}
