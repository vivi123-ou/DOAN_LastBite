"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getGroupOrderInviteAction,
  joinGroupOrderAction,
} from "@/app/(customer)/friends/[friendshipId]/actions";
import type { GroupOrderInvite } from "@/lib/domain/social";

function formatDeadline(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return "Đã hết hạn";
  const days = Math.floor(diffMs / 86_400_000);
  const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);
  if (days >= 1) return `Còn ${days} ngày`;
  return `Còn ${hours} giờ`;
}

// A group-buy invite renders as a card instead of a plain text bubble —
// fetched on mount rather than passed down from the server, since this is
// also how a message that just arrived via Realtime (chat-view.tsx) gets
// its invite details: there's no server round trip attached to a Realtime
// payload, so every invite card (initial load or live) goes through this
// same client-side fetch uniformly.
export function GroupOrderInviteCard({
  groupOrderId,
  isOwnMessage,
}: {
  groupOrderId: string;
  isOwnMessage: boolean;
}) {
  const [invite, setInvite] = useState<GroupOrderInvite | null | "loading">("loading");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getGroupOrderInviteAction(groupOrderId).then((result) => {
      if (!cancelled) setInvite(result);
    });
    return () => {
      cancelled = true;
    };
  }, [groupOrderId]);

  async function handleJoin() {
    setJoining(true);
    try {
      await joinGroupOrderAction(groupOrderId);
      setInvite((prev) => (prev && prev !== "loading" ? { ...prev, isViewerParticipant: true, participantCount: prev.participantCount + (prev.isViewerParticipant ? 0 : 1) } : prev));
      toast.success("Đã tham gia mua chung!");
    } catch {
      toast.error("Không tham gia được, thử lại sau.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
      <Card className="w-72 gap-0 py-0">
        <CardContent className="space-y-2 p-4">
          <div className="flex items-center gap-2 text-primary">
            <Gift className="size-4" />
            <span className="text-sm font-semibold">Mời mua chung</span>
          </div>
          {invite === "loading" ? (
            <p className="text-sm text-muted-foreground">Đang tải...</p>
          ) : invite === null ? (
            <p className="text-sm text-muted-foreground">Không tìm thấy lời mời này.</p>
          ) : (
            <>
              <p className="text-sm font-medium">{invite.storeName}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="size-3.5" />
                  {invite.participantCount} người tham gia
                </span>
                <span>{formatDeadline(invite.deadline)}</span>
              </div>
              <div className="flex gap-2 pt-1">
                {invite.isViewerParticipant ? (
                  <span className="text-xs font-medium text-primary">Bạn đã tham gia</span>
                ) : (
                  <Button size="sm" onClick={handleJoin} disabled={joining || invite.status !== "open"}>
                    Tham gia
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
