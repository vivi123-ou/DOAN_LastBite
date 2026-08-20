"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Users, Gift, Minus, Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

function initialOf(name: string | null) {
  return (name?.trim()?.[0] ?? "?").toUpperCase();
}

// Progress line toward the next bulk-discount tier — "no fake progress
// bar" was the explicit call for the Net Zero points page (no VIP tiers
// there), but this one is different: the tiers here are real, store-
// configured (or platform-default) thresholds that genuinely determine the
// price everyone in the group pays, not a cosmetic gamification layer.
function tierMessage(invite: GroupOrderInvite): string | null {
  if (invite.currentTier && !invite.nextTier) {
    return `Đã đạt mức giảm ${invite.currentTier.discountPct}% cho cả nhóm!`;
  }
  if (invite.currentTier && invite.nextTier) {
    const remaining = invite.nextTier.minQuantity - invite.totalQuantity;
    return `Đang giảm ${invite.currentTier.discountPct}% — mua thêm ${remaining} phần nữa để được giảm ${invite.nextTier.discountPct}%.`;
  }
  if (invite.nextTier) {
    const remaining = invite.nextTier.minQuantity - invite.totalQuantity;
    return `Mua thêm ${remaining} phần nữa để cả nhóm được giảm ${invite.nextTier.discountPct}%.`;
  }
  return null; // store has no bulk-discount tiers configured at all
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
  const [quantity, setQuantity] = useState(1);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getGroupOrderInviteAction(groupOrderId).then((result) => {
      if (cancelled) return;
      setInvite(result);
      if (result && result.viewerQuantity > 0) {
        setQuantity(result.viewerQuantity);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [groupOrderId]);

  async function handleJoin() {
    setJoining(true);
    try {
      await joinGroupOrderAction(groupOrderId, quantity);
      // Re-fetch rather than hand-patch the local state — joining changes
      // totalQuantity/currentTier/nextTier/participants too, not just
      // isViewerParticipant, and recomputing that tier math client-side
      // would just be duplicating resolveTier() for no real benefit.
      const refreshed = await getGroupOrderInviteAction(groupOrderId);
      setInvite(refreshed);
      toast.success("Đã tham gia mua chung!");
    } catch {
      toast.error("Không tham gia được, thử lại sau.");
    } finally {
      setJoining(false);
    }
  }

  const isExpired = invite !== "loading" && invite !== null && new Date(invite.deadline) <= new Date();
  const message = invite !== "loading" && invite !== null ? tierMessage(invite) : null;

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
              {/* comboName is null for invites created before combo_id
                  existed (0019) — those just fall back to the store name
                  alone, same as before this round. */}
              <p className="text-sm font-medium">{invite.comboName ?? invite.storeName}</p>
              {invite.comboName && (
                <p className="text-xs text-muted-foreground">{invite.storeName}</p>
              )}

              {invite.participants.length > 0 && (
                <div className="flex items-center -space-x-2">
                  {invite.participants.slice(0, 5).map((p) => (
                    <Avatar key={p.userId} className="size-6 border-2 border-background">
                      {p.avatarUrl && <AvatarImage src={p.avatarUrl} alt="" />}
                      <AvatarFallback className="text-[10px]">{initialOf(p.fullName)}</AvatarFallback>
                    </Avatar>
                  ))}
                  {invite.participants.length > 5 && (
                    <span className="flex size-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium">
                      +{invite.participants.length - 5}
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="size-3.5" />
                  {invite.participantCount} người · {invite.totalQuantity} phần
                </span>
                <span>{formatDeadline(invite.deadline)}</span>
              </div>

              {message && <p className="text-xs font-medium text-primary">{message}</p>}

              {invite.status !== "open" || isExpired ? (
                <p className="pt-1 text-xs text-muted-foreground">Lời mời đã đóng.</p>
              ) : (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="w-6 text-center text-sm">{quantity}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => setQuantity((q) => q + 1)}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                    <Button size="sm" onClick={handleJoin} disabled={joining} className="flex-1">
                      {invite.isViewerParticipant ? "Cập nhật số lượng" : "Tham gia"}
                    </Button>
                  </div>
                  {invite.isViewerParticipant && invite.comboId && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      nativeButton={false}
                      render={
                        <Link href={`/combos/${invite.comboId}?groupOrderId=${invite.groupOrderId}`}>
                          <ShoppingCart className="mr-1.5 size-3.5" />
                          Đặt hàng theo nhóm
                        </Link>
                      }
                    />
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
