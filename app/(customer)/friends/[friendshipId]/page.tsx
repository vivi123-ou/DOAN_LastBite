import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getById as getFriendship } from "@/lib/repositories/friend.repository";
import { getById as getProfileById } from "@/lib/repositories/profile.repository";
import { listForFriendship } from "@/lib/repositories/message.repository";
import { listVerified } from "@/lib/repositories/store.repository";
import { ChatView } from "@/app/(customer)/friends/[friendshipId]/_components/chat-view";

export default async function FriendChatPage({
  params,
}: {
  params: Promise<{ friendshipId: string }>;
}) {
  const { friendshipId } = await params;
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect(`/login?next=/friends/${friendshipId}`);

  // getById already returns null for a friendship the caller isn't a party
  // to (friendships_select_own RLS) — no separate authorization check
  // needed before treating that as "not found".
  const friendship = await getFriendship(supabase, friendshipId);
  if (!friendship) notFound();

  const otherId = friendship.requester_id === userId ? friendship.addressee_id : friendship.requester_id;
  // Admin client for the other party's profile specifically — same RLS gap
  // (and same fix) as friend.repository.ts's listFriendships(). Everything
  // else here is a same-actor read, regular client is correct for those.
  const [otherProfile, messages, stores] = await Promise.all([
    getProfileById(createAdminClient(), otherId),
    listForFriendship(supabase, friendshipId),
    listVerified(supabase),
  ]);

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-2xl flex-col px-4 py-4">
      <ChatView
        friendshipId={friendshipId}
        currentUserId={userId}
        isAccepted={friendship.status === "accepted"}
        otherName={otherProfile?.fullName ?? "Người dùng LastBite"}
        otherAvatarUrl={otherProfile?.avatarUrl ?? null}
        initialMessages={messages}
        stores={stores}
      />
    </div>
  );
}
