"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getById as getProfileById } from "@/lib/repositories/profile.repository";
import {
  getFriendshipBetween,
  remove as removeFriendship,
  respondToRequest,
  searchUsers,
  sendRequest,
} from "@/lib/repositories/friend.repository";
import { create as createNotification } from "@/lib/repositories/notification.repository";
import type { PublicProfile } from "@/lib/domain/social";

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
    throw new Error(
      existing.status === "accepted" ? "Hai bạn đã là bạn bè." : "Lời mời kết bạn đã tồn tại."
    );
  }

  await sendRequest(supabase, userId, addresseeId);

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
