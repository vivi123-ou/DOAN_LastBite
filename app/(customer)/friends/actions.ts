"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getById as getProfileById } from "@/lib/repositories/profile.repository";
import {
  blockExisting,
  blockNew,
  getById as getFriendshipById,
  getFriendshipBetween,
  listFriendships,
  remove as removeFriendship,
  resendRequest,
  respondToRequest,
  searchUsers,
  sendRequest,
  unblock,
} from "@/lib/repositories/friend.repository";
import { create as createNotification } from "@/lib/repositories/notification.repository";
import type { FriendSummary, PublicProfile } from "@/lib/domain/social";

// Feeds the "Chia sẻ mua chung" friend picker on the combo detail page
// (components/combo/share-group-buy-button.tsx) — only accepted friends
// make sense there (you can't invite someone you're not even friends with
// yet). Reuses listFriendships() rather than a new narrower repository
// query — this app's friend list is small enough that filtering client-
// side-of-the-action to `status === "accepted"` is simpler than a second
// SQL shape for what's ultimately the same underlying data.
export async function listAcceptedFriendsAction(): Promise<FriendSummary[]> {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) return [];

  const admin = createAdminClient();
  const friendships = await listFriendships(supabase, admin, userId);
  return friendships.filter((f) => f.status === "accepted");
}

export async function searchUsersAction(query: string): Promise<PublicProfile[]> {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) return [];

  const admin = createAdminClient();
  return searchUsers(admin, query, userId);
}

// Cross-actor: creating the friendship row itself is same-actor (regular
// client, friendships_insert_own RLS), but notifying the *addressee* about
// it needs the service-role client — same posture as every other
// notification write (notification.repository.ts).
export async function sendFriendRequestAction(addresseeId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập.");
  if (userId === addresseeId) throw new Error("Không thể kết bạn với chính mình.");

  const existing = await getFriendshipBetween(supabase, userId, addresseeId);
  if (existing) {
    if (existing.blocked_by) throw new Error("Không thể gửi lời mời kết bạn.");
    if (existing.status === "accepted") throw new Error("Hai bạn đã là bạn bè.");
    if (existing.status === "pending") throw new Error("Lời mời kết bạn đã tồn tại.");
    // status === 'rejected', not blocked — reuse the existing row (resend)
    // instead of inserting a duplicate, which the unique(requester_id,
    // addressee_id) constraint would otherwise reject outright.
    await resendRequest(supabase, existing.id, userId, addresseeId);
  } else {
    await sendRequest(supabase, userId, addresseeId);
  }

  const requesterProfile = await getProfileById(supabase, userId);
  const admin = createAdminClient();
  await createNotification(admin, {
    userId: addresseeId,
    type: "friend_request",
    title: `${requesterProfile?.fullName ?? "Một người dùng"} đã gửi lời mời kết bạn`,
    payload: { requesterId: userId },
  }).catch(() => {});

  revalidatePath("/friends");
}

// One action covers both "huỷ lời mời đã gửi" (cancel a still-pending
// outgoing request) and "huỷ kết bạn" (unfriend an accepted friendship) —
// friendships_delete_own RLS (0018) already scopes this to rows the caller
// is a party to, regardless of status, same as respondFriendRequestAction
// doesn't need a separate ownership check either.
export async function removeFriendshipAction(friendshipId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập.");

  await removeFriendship(supabase, friendshipId);
  revalidatePath("/friends");
}

// Blocks regardless of whether a friendship row already exists — folds
// into that row (severing any accepted status) if one does, inserts a
// fresh blocked-only row (no prior relationship) if not. Either way, the
// blocker is always the one calling this from their own /friends page.
export async function blockUserAction(otherUserId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập.");

  const existing = await getFriendshipBetween(supabase, userId, otherUserId);
  if (existing) {
    await blockExisting(supabase, existing.id, userId);
  } else {
    await blockNew(supabase, userId, otherUserId);
  }
  revalidatePath("/friends");
}

// Only clears the block flag — does not restore an accepted friendship or
// auto-send a new request. Unblocking someone you blocked and re-friending
// them are two different, deliberate actions.
export async function unblockUserAction(friendshipId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập.");

  // friendships_update_either_party RLS (0033) permits either party to
  // update this row, so this ownership check is the only thing stopping a
  // blocked user from unblocking *themselves* by calling this action
  // directly — only the party who actually did the blocking may undo it.
  const friendship = await getFriendshipById(supabase, friendshipId);
  if (!friendship || friendship.blocked_by !== userId) {
    throw new Error("Bạn không thể bỏ chặn ở đây.");
  }

  await unblock(supabase, friendshipId);
  revalidatePath("/friends");
}

export async function respondFriendRequestAction(friendshipId: string, accept: boolean) {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập.");

  const updated = await respondToRequest(supabase, friendshipId, accept);

  if (accept) {
    const addresseeProfile = await getProfileById(supabase, userId);
    const admin = createAdminClient();
    await createNotification(admin, {
      userId: updated.requester_id,
      type: "friend_accepted",
      title: `${addresseeProfile?.fullName ?? "Một người dùng"} đã chấp nhận lời mời kết bạn`,
      payload: { addresseeId: userId },
    }).catch(() => {});
  }

  revalidatePath("/friends");
}
