"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Send, Gift } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import {
  sendMessageAction,
  createGroupOrderInviteAction,
  markThreadReadAction,
} from "@/app/(customer)/friends/[friendshipId]/actions";
import { GroupOrderInviteCard } from "@/app/(customer)/friends/[friendshipId]/_components/group-order-invite-card";
import type { Message } from "@/lib/domain/social";
import type { StoreComboSummary } from "@/lib/domain/combo";
import type { Database } from "@/types/database.types";

function initialOf(name: string) {
  return (name.trim()[0] ?? "?").toUpperCase();
}

interface ChatViewProps {
  friendshipId: string;
  currentUserId: string;
  isAccepted: boolean;
  otherName: string;
  otherAvatarUrl: string | null;
  initialMessages: Message[];
  stores: { id: string; name: string }[];
}

export function ChatView({
  friendshipId,
  currentUserId,
  isAccepted,
  otherName,
  otherAvatarUrl,
  initialMessages,
  stores,
}: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [storeCombos, setStoreCombos] = useState<StoreComboSummary[]>([]);
  const [comboId, setComboId] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Re-fetches the picked store's active combos whenever the store
  // selection changes, only while the dialog's actually open — reuses the
  // same paginated endpoint the map's store-detail-panel.tsx already calls,
  // just taking its first page (10) rather than the whole catalog, which is
  // plenty for a picker list. Clearing the previous store's combo/selection
  // happens in handleStoreChange below (a real event), not here — an effect
  // resetting its own state synchronously on every dependency change is the
  // anti-pattern react-hooks/set-state-in-effect flags elsewhere in this
  // codebase; this effect's only setState call is inside the fetch's own
  // callback, not synchronously in the effect body.
  useEffect(() => {
    if (!inviteOpen || !storeId) return;
    let cancelled = false;
    fetch(`/api/stores/${storeId}/combos`)
      .then((r) => (r.ok ? r.json() : { combos: [] }))
      .then((data) => {
        if (cancelled) return;
        setStoreCombos(data.combos ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [inviteOpen, storeId]);

  function handleStoreChange(value: string) {
    setStoreId(value);
    setComboId("");
    setStoreCombos([]);
  }

  // Real-time delivery for both sides of the thread — messages_select_thread
  // RLS (0010) scopes the subscriber's own session to rows where they're a
  // party, so this only ever receives messages from *this* friendship.
  // Sending your own message also arrives back through this same channel
  // (Realtime honors RLS per-subscriber, and the sender is a valid reader
  // of their own insert), so there's no separate optimistic-append path —
  // one source of truth, no risk of a duplicated bubble.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${friendshipId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `friendship_id=eq.${friendshipId}` },
        (payload) => {
          const row = payload.new as Database["public"]["Tables"]["messages"]["Row"];
          setMessages((prev) =>
            prev.some((m) => m.id === row.id)
              ? prev
              : [
                  ...prev,
                  {
                    id: row.id,
                    friendshipId: row.friendship_id,
                    senderId: row.sender_id,
                    body: row.body,
                    groupOrderId: row.group_order_id,
                    createdAt: row.created_at,
                  },
                ]
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [friendshipId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Marks this thread read the moment it's actually opened, so /friends'
  // unread badge for it clears on the next visit there — best-effort, a
  // failed mark-read shouldn't block viewing the chat itself.
  useEffect(() => {
    markThreadReadAction(friendshipId).catch(() => {});
  }, [friendshipId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setDraft("");
    setSending(true);
    try {
      await sendMessageAction(friendshipId, body);
    } catch {
      toast.error("Không gửi được tin nhắn.");
    } finally {
      setSending(false);
    }
  }

  async function handleCreateInvite() {
    if (!storeId || !comboId) {
      toast.error("Chọn cửa hàng và sản phẩm muốn mua chung trước đã.");
      return;
    }
    try {
      await createGroupOrderInviteAction(friendshipId, storeId, comboId);
      setInviteOpen(false);
      toast.success("Đã gửi lời mời mua chung.");
    } catch {
      toast.error("Không tạo được lời mời mua chung.");
    }
  }

  return (
    <div className="flex h-full flex-col rounded-lg border">
      <div className="flex items-center gap-3 border-b p-3">
        <Avatar>
          {otherAvatarUrl && <AvatarImage src={otherAvatarUrl} alt="" />}
          <AvatarFallback>{initialOf(otherName)}</AvatarFallback>
        </Avatar>
        <span className="font-semibold">{otherName}</span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Chưa có tin nhắn nào. Nói xin chào nhé!
          </p>
        )}
        {messages.map((m) =>
          m.groupOrderId ? (
            <GroupOrderInviteCard key={m.id} groupOrderId={m.groupOrderId} isOwnMessage={m.senderId === currentUserId} />
          ) : (
            <div key={m.id} className={`flex ${m.senderId === currentUserId ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                  m.senderId === currentUserId
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {m.body}
              </div>
            </div>
          )
        )}
        <div ref={bottomRef} />
      </div>

      {isAccepted ? (
        <form onSubmit={handleSend} className="flex items-center gap-2 border-t p-3">
          <Button type="button" variant="outline" size="icon" onClick={() => setInviteOpen(true)} title="Mời mua chung">
            <Gift className="size-4" />
          </Button>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Nhắn gì đó..."
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={sending || !draft.trim()}>
            <Send className="size-4" />
          </Button>
        </form>
      ) : (
        <p className="border-t p-3 text-center text-sm text-muted-foreground">
          Chấp nhận lời mời kết bạn để bắt đầu nhắn tin.
        </p>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mời mua chung</DialogTitle>
            <DialogDescription>
              Chọn một sản phẩm cụ thể để rủ bạn bè mua chung. Mua càng nhiều người, càng nhiều khả
              năng đạt mức giảm giá theo số lượng của cửa hàng. Lời mời sẽ tự động hết hạn cùng lúc
              với hạn bán (Best Before) của sản phẩm đó.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Cửa hàng</label>
              <Select value={storeId} onValueChange={(v) => handleStoreChange(v ?? "")} items={stores.map((s) => ({ value: s.id, label: s.name }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chọn cửa hàng" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Sản phẩm muốn mua chung</label>
              <Select
                value={comboId}
                onValueChange={(v) => setComboId(v ?? "")}
                items={storeCombos.map((c) => ({
                  value: c.comboId,
                  label: `${c.name} · ${c.currentPrice.toLocaleString("vi-VN")}đ`,
                }))}
                disabled={!storeId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={storeCombos.length === 0 ? "Đang tải / chưa có combo nào" : "Chọn sản phẩm"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {storeCombos.map((c) => (
                    <SelectItem key={c.comboId} value={c.comboId}>
                      {c.name} · {c.currentPrice.toLocaleString("vi-VN")}đ
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Huỷ
            </Button>
            <Button onClick={handleCreateInvite} disabled={!storeId || !comboId}>
              Tạo lời mời
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
