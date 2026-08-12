"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, UserPlus, Check, X, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  searchUsersAction,
  sendFriendRequestAction,
  respondFriendRequestAction,
} from "@/app/(customer)/friends/actions";
import type { FriendSummary, PublicProfile } from "@/lib/domain/social";

function initialOf(name: string | null) {
  return (name?.trim()?.[0] ?? "?").toUpperCase();
}

export function FriendsView({ initialFriendships }: { initialFriendships: FriendSummary[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicProfile[] | null>(null);
  const [searching, setSearching] = useState(false);

  const incoming = initialFriendships.filter((f) => f.isIncomingRequest);
  const accepted = initialFriendships.filter((f) => f.status === "accepted");
  const outgoing = initialFriendships.filter((f) => f.status === "pending" && !f.isIncomingRequest);

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
              {results.map((u) => (
                <li key={u.userId} className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt="" />}
                      <AvatarFallback>{initialOf(u.fullName)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{u.fullName ?? "Người dùng LastBite"}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleAdd(u.userId)}>
                    <UserPlus className="mr-1.5 size-4" />
                    Kết bạn
                  </Button>
                </li>
              ))}
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
            {accepted.map((f) => (
              <li key={f.friendshipId}>
                <Link
                  href={`/friends/${f.friendshipId}`}
                  className="flex items-center justify-between gap-3 rounded-md border p-3 hover:border-primary"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      {f.avatarUrl && <AvatarImage src={f.avatarUrl} alt="" />}
                      <AvatarFallback>{initialOf(f.fullName)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{f.fullName ?? "Người dùng LastBite"}</span>
                  </div>
                  <MessageCircle className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

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
                <span className="text-xs text-muted-foreground">Đang chờ</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
