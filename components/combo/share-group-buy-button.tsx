"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listAcceptedFriendsAction } from "@/app/(customer)/friends/actions";
import { createGroupOrderInviteAction } from "@/app/(customer)/friends/[friendshipId]/actions";
import type { FriendSummary } from "@/lib/domain/social";

function initialOf(name: string | null) {
  return (name?.trim()?.[0] ?? "?").toUpperCase();
}

// "Chia sẻ mua chung" straight from the product itself — the only way to
// start a group-buy invite before this was from inside an existing 1:1
// chat thread (chat-view.tsx's Gift icon), picking the store *and* combo
// manually from dropdowns. This starts from the product already known
// (storeId/comboId are this combo's own), the only thing left to pick is
// who to send it to — reuses the exact same createGroupOrderInviteAction
// the chat dialog calls, just invoked with this combo pre-filled instead
// of picked from a Select.
export function ShareGroupBuyButton({ storeId, comboId }: { storeId: string; comboId: string }) {
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<FriendSummary[] | "loading" | null>(null);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [invitedId, setInvitedId] = useState<string | null>(null);

  function handleOpen() {
    setOpen(true);
    setFriends("loading");
    listAcceptedFriendsAction().then(setFriends);
  }

  async function handleInvite(friendshipId: string) {
    setInvitingId(friendshipId);
    try {
      await createGroupOrderInviteAction(friendshipId, storeId, comboId);
      setInvitedId(friendshipId);
      toast.success("Đã gửi lời mời mua chung trong đoạn chat.");
    } catch {
      toast.error("Không gửi được lời mời, thử lại sau.");
    } finally {
      setInvitingId(null);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={handleOpen}>
        <Users className="mr-2 size-4" />
        Chia sẻ mua chung
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mời bạn bè mua chung</DialogTitle>
            <DialogDescription>
              Chọn một người bạn để mời cùng mua sản phẩm này — mua càng nhiều người, càng nhiều
              khả năng đạt mức giảm giá theo số lượng.
            </DialogDescription>
          </DialogHeader>

          {friends === "loading" ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Đang tải...</p>
          ) : friends === null || friends.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Bạn chưa có bạn bè nào.{" "}
              <Link href="/friends" className="font-medium text-primary hover:underline">
                Kết bạn ngay
              </Link>
              .
            </p>
          ) : (
            <ul className="max-h-72 space-y-1.5 overflow-y-auto">
              {friends.map((f) => (
                <li key={f.friendshipId} className="flex items-center justify-between gap-3 rounded-md border p-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar size="sm">
                      {f.avatarUrl && <AvatarImage src={f.avatarUrl} alt="" />}
                      <AvatarFallback className="text-xs">{initialOf(f.fullName)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{f.fullName ?? "Người dùng LastBite"}</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={invitedId === f.friendshipId ? "outline" : "default"}
                    disabled={invitingId === f.friendshipId || invitedId === f.friendshipId}
                    onClick={() => handleInvite(f.friendshipId)}
                  >
                    {invitedId === f.friendshipId ? "Đã gửi" : "Mời"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
