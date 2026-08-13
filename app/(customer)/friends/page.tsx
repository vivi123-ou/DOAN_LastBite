import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { listFriendships } from "@/lib/repositories/friend.repository";
import { getUnreadCounts } from "@/lib/repositories/message.repository";
import { FriendsView } from "@/app/(customer)/friends/_components/friends-view";

export default async function FriendsPage() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login?next=/friends");

  // Admin client needed for the *other* party's profile in each row — see
  // listFriendships()'s own comment for why (profiles' RLS is deliberately
  // too narrow for a regular client to read a friend's name/avatar).
  const [friendships, unreadCounts] = await Promise.all([
    listFriendships(supabase, createAdminClient(), userId),
    // Same "missing table degrades gracefully" resilience exception used
    // elsewhere for a brand-new table (0024) — the whole friends page
    // shouldn't break just because the unread-badge feature can't load yet.
    getUnreadCounts(supabase).catch(() => new Map<string, number>()),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Bạn bè</h1>
        <p className="text-sm text-muted-foreground">
          Kết bạn, nhắn tin và mời nhau mua chung để được giảm giá theo số lượng.
        </p>
      </div>
      <FriendsView
        initialFriendships={friendships}
        unreadCounts={Object.fromEntries(unreadCounts)}
      />
    </div>
  );
}
