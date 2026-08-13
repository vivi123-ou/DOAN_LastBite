"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getById as getFriendship } from "@/lib/repositories/friend.repository";
import { getById as getProfileById } from "@/lib/repositories/profile.repository";
import { send as sendMessage } from "@/lib/repositories/message.repository";
import { create as createNotification } from "@/lib/repositories/notification.repository";
import { getSnapshotsByIds } from "@/lib/repositories/combo.repository";
import * as groupBuy from "@/lib/repositories/group-buy.repository";
import type { GroupOrderInvite } from "@/lib/domain/social";

async function requireParty(friendshipId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập.");

  const friendship = await getFriendship(supabase, friendshipId);
  if (!friendship) throw new Error("Không tìm thấy cuộc trò chuyện.");

  const otherId = friendship.requester_id === userId ? friendship.addressee_id : friendship.requester_id;
  return { supabase, userId, friendship, otherId };
}

export async function sendMessageAction(friendshipId: string, body: string) {
  const { supabase, userId, otherId } = await requireParty(friendshipId);
  if (!body.trim()) return;

  await sendMessage(supabase, { friendshipId, senderId: userId, body: body.trim() });

  const senderProfile = await getProfileById(supabase, userId);
  const admin = createAdminClient();
  await createNotification(admin, {
    userId: otherId,
    type: "message",
    title: `${senderProfile?.fullName ?? "Bạn bè"} đã nhắn tin cho bạn`,
    body: body.trim().slice(0, 80),
    payload: { conversationId: friendshipId },
  }).catch(() => {});

  revalidatePath(`/friends/${friendshipId}`);
}

// Not user-configurable (see chat-view.tsx — the deadline chip picker was
// removed per explicit feedback: "hệ thống tự mặc định" instead of asking).
// The deadline is the combo's *own* best_before, not a fixed day count —
// explicit follow-up feedback: a group-buy invite for a same-day combo
// (this app's combos typically expire in hours, not days — see
// business-rules.md's per-combo Best Before rule) made no sense staying
// "open" for a fixed 3 days after the product itself was long gone/unbuyable.
// Tying the two together means the invite naturally shows "Đã hết hạn" —
// same isExpired check already in group-order-invite-card.tsx, no separate
// logic needed there — at the exact moment the product stops being
// sellable, and checkout's resolveCheckoutDiscount() (which also checks
// `deadline <= now()`) rejects it at the same moment too.
//
// "Mời mua chung" — creates the group_orders row (+ auto-joins the
// initiator), then posts it as a message carrying group_order_id so it
// renders as an invite card in the thread (group-order-invite-card.tsx).
// `comboId` is required, not optional: the invite now points at a specific
// product to buy together, not just a store with no idea what to buy.
export async function createGroupOrderInviteAction(
  friendshipId: string,
  storeId: string,
  comboId: string
) {
  const { supabase, userId, otherId } = await requireParty(friendshipId);

  const admin = createAdminClient();

  const [combo] = await getSnapshotsByIds(admin, [comboId]);
  if (!combo || combo.status !== "active" || new Date(combo.bestBefore) <= new Date()) {
    throw new Error("Sản phẩm này đã hết hạn hoặc không còn bán, không thể tạo lời mời.");
  }

  const { id: groupOrderId } = await groupBuy.create(admin, {
    initiatorId: userId,
    storeId,
    comboId,
    deadline: combo.bestBefore,
  });

  await sendMessage(supabase, {
    friendshipId,
    senderId: userId,
    body: "Đã tạo lời mời mua chung 🎉",
    groupOrderId,
  });

  const senderProfile = await getProfileById(supabase, userId);
  await createNotification(admin, {
    userId: otherId,
    type: "group_buy_invite",
    title: `${senderProfile?.fullName ?? "Bạn bè"} mời bạn mua chung`,
    payload: { conversationId: friendshipId, groupOrderId },
  }).catch(() => {});

  revalidatePath(`/friends/${friendshipId}`);
}

export async function joinGroupOrderAction(groupOrderId: string, quantity: number) {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập.");

  const admin = createAdminClient();
  await groupBuy.join(admin, groupOrderId, userId, Math.max(1, Math.floor(quantity)));
}

export async function getGroupOrderInviteAction(groupOrderId: string): Promise<GroupOrderInvite | null> {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) return null;

  const admin = createAdminClient();
  return groupBuy.getInvite(admin, groupOrderId, userId);
}
