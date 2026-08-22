"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  UserPlus,
  Check,
  X,
  MessageCircle,
  UserMinus,
  UserCheck,
  Clock,
  Ban,
  ShieldOff,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  searchUsersAction,
  sendFriendRequestAction,
  respondFriendRequestAction,
  removeFriendshipAction,
  blockUserAction,
  unblockUserAction,
} from "@/app/(customer)/friends/actions";
import type { FriendSummary, PublicProfile } from "@/lib/domain/social";

function initialOf(name: string | null) {
  return (name?.trim()?.[0] ?? "?").toUpperCase();
}

export function FriendsView({
  initialFriendships,
  unreadCounts,
  currentUserId,
}: {
  initialFriendships: FriendSummary[];
  // Plain object, not a Map — Server Components can only pass RSC-serializable
  // props across the boundary; friends/page.tsx converts the Map from
  // getUnreadCounts() with Object.fromEntries() before handing it down.
  unreadCounts: Record<string, number>;
  // Needed to tell "you blocked them" (show "Bỏ chặn") apart from "they
  // blocked you" (show nothing actionable) — blockedBy alone doesn't say
  // which direction from the client's perspective.
  currentUserId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicProfile[] | null>(null);
  const [searching, setSearching] = useState(false);

  // A blocked friendship's status is always 'rejected' (blockExisting sets
  // it) — so without this explicit filter, a blocked-by-me row would
  // silently vanish from every section below instead of surfacing
  // somewhere the blocker can undo it.
  const blockedByMe = initialFriendships.filter((f) => f.blockedBy === currentUserId);
  const visible = initialFriendships.filter((f) => !f.blockedBy);
  const incoming = visible.filter((f) => f.isIncomingRequest);
  const accepted = visible.filter((f) => f.status === "accepted");
  const outgoing = visible.filter((f) => f.status === "pending" && !f.isIncomingRequest);

  // search_profiles() (the RPC behind searchUsersAction) has no idea who
  // the caller is already friends/pending with — it just matches on name —
  // so a search result needs to be cross-referenced against the friendship
  // list already loaded for this page, or someone you're already friends
  // with (or already have a pending request with, either direction) keeps
  // showing a live "Kết bạn" button that just errors ("Lời mời kết bạn đã
  // tồn tại." / "Hai bạn đã là bạn bè.") when clicked instead of reflecting
  // the real relationship.
  const friendshipByUserId = new Map(initialFriendships.map((f) => [f.userId, f]));

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      setResults(await searchUsersAction(query));
    } finally {
      setSearching(false);
    }
  }

  async function handleAdd(userId: string) {
    try {
      await sendFriendRequestAction(userId);
      toast.success("Đã gửi lời mời kết bạn.");
      setResults((r) => r?.filter((u) => u.userId !== userId) ?? r);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không gửi được lời mời.");
    }
  }

  async function handleRespond(friendshipId: string, accept: boolean) {
    try {
      await respondFriendRequestAction(friendshipId, accept);
      toast.success(accept ? "Đã trở thành bạn bè." : "Đã từ chối lời mời.");
      router.refresh();
    } catch {
      toast.error("Có lỗi xảy ra, thử lại sau.");
    }
  }

  // Shared by "Huỷ lời mời" (still pending) and "Huỷ kết bạn" (accepted) —
  // the latter also clears the chat thread (messages cascade off the
  // deleted friendships row, 0010), so it gets a confirm prompt; cancelling
  // a not-yet-accepted request has nothing to lose, no prompt needed.
  async function handleRemove(friendshipId: string, confirmMessage?: string) {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    try {
      await removeFriendshipAction(friendshipId);
      toast.success("Đã cập nhật.");
      router.refresh();
    } catch {
      toast.error("Có lỗi xảy ra, thử lại sau.");
    }
  }

  async function handleBlock(userId: string, name: string | null) {
    if (!window.confirm(`Chặn ${name ?? "người này"}? Họ sẽ không thể nhắn tin hoặc mời bạn mua chung nữa.`))
      return;
    try {
      await blockUserAction(userId);
      toast.success("Đã chặn.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra, thử lại sau.");
    }
  }

  async function handleUnblock(friendshipId: string) {
    try {
      await unblockUserAction(friendshipId);
      toast.success("Đã bỏ chặn.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra, thử lại sau.");
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm bạn bè theo tên..."
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={searching}>
          Tìm
        </Button>
      </form>

      {results && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Kết quả tìm kiếm</h2>
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">Không tìm thấy ai phù hợp.</p>
          ) : (
            <ul className="space-y-2">
              {results.map((u) => {
                const existing = friendshipByUserId.get(u.userId);
                return (
                  <li key={u.userId} className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt="" />}
                        <AvatarFallback>{initialOf(u.fullName)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{u.fullName ?? "Người dùng LastBite"}</span>
                    </div>
                    {existing?.blockedBy === currentUserId ? (
                      <Button size="sm" variant="outline" onClick={() => handleUnblock(existing.friendshipId)}>
                        <ShieldOff className="mr-1.5 size-4" />
                        Bỏ chặn
                      </Button>
                    ) : existing?.blockedBy ? (
                      <span className="text-xs text-muted-foreground">Không thể kết bạn</span>
                    ) : existing?.status === "accepted" ? (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                        <UserCheck className="size-4" />
                        Đã là bạn bè
                      </span>
                    ) : existing?.status === "pending" ? (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="size-4" />
                        {existing.isIncomingRequest ? "Đã gửi lời mời cho bạn" : "Đã gửi lời mời"}
                      </span>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => handleAdd(u.userId)}>
                        <UserPlus className="mr-1.5 size-4" />
                        Kết bạn
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {incoming.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Lời mời kết bạn</h2>
          <ul className="space-y-2">
            {incoming.map((f) => (
              <li key={f.friendshipId} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="flex items-center gap-3">
                  <Avatar>
                    {f.avatarUrl && <AvatarImage src={f.avatarUrl} alt="" />}
                    <AvatarFallback>{initialOf(f.fullName)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{f.fullName ?? "Người dùng LastBite"}</span>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" onClick={() => handleRespond(f.friendshipId, true)}>
                    <Check className="size-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleRespond(f.friendshipId, false)}>
                    <X className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Bạn bè ({accepted.length})</h2>
        {accepted.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Chưa có bạn bè nào. Tìm kiếm ở trên để kết bạn nhé!
          </p>
        ) : (
          <ul className="space-y-2">
            {accepted.map((f) => {
              const unread = unreadCounts[f.friendshipId] ?? 0;
              return (
              <li key={f.friendshipId} className="flex items-center gap-2">
                <Link
                  href={`/friends/${f.friendshipId}`}
                  className="flex flex-1 items-center justify-between gap-3 rounded-md border p-3 hover:border-primary"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      {f.avatarUrl && <AvatarImage src={f.avatarUrl} alt="" />}
                      <AvatarFallback>{initialOf(f.fullName)}</AvatarFallback>
                    </Avatar>
                    <span className={`text-sm ${unread > 0 ? "font-semibold" : "font-medium"}`}>
                      {f.fullName ?? "Người dùng LastBite"}
                    </span>
                  </div>
                  <div className="relative">
                    <MessageCircle className="size-4 text-muted-foreground" />
                    {unread > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </div>
                </Link>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Chặn"
                  onClick={() => handleBlock(f.userId, f.fullName)}
                >
                  <Ban className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Huỷ kết bạn"
                  onClick={() =>
                    handleRemove(
                      f.friendshipId,
                      `Huỷ kết bạn với ${f.fullName ?? "người này"}? Toàn bộ tin nhắn giữa hai bạn sẽ bị xoá.`
                    )
                  }
                >
                  <UserMinus className="size-4" />
                </Button>
              </li>
              );
            })}
          </ul>
        )}
      </section>

      {blockedByMe.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Đã chặn</h2>
          <ul className="space-y-2">
            {blockedByMe.map((f) => (
              <li key={f.friendshipId} className="flex items-center justify-between gap-3 rounded-md border p-3 opacity-70">
                <div className="flex items-center gap-3">
                  <Avatar>
                    {f.avatarUrl && <AvatarImage src={f.avatarUrl} alt="" />}
                    <AvatarFallback>{initialOf(f.fullName)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{f.fullName ?? "Người dùng LastBite"}</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleUnblock(f.friendshipId)}>
                  <ShieldOff className="mr-1.5 size-4" />
                  Bỏ chặn
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Đã gửi lời mời</h2>
          <ul className="space-y-2">
            {outgoing.map((f) => (
              <li key={f.friendshipId} className="flex items-center justify-between gap-3 rounded-md border p-3 opacity-70">
                <div className="flex items-center gap-3">
                  <Avatar>
                    {f.avatarUrl && <AvatarImage src={f.avatarUrl} alt="" />}
                    <AvatarFallback>{initialOf(f.fullName)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{f.fullName ?? "Người dùng LastBite"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Đang chờ</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleRemove(f.friendshipId)}
                  >
                    Huỷ lời mời
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
