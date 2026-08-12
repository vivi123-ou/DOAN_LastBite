"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { countUnread, listForUser, markAllRead } from "@/lib/repositories/notification.repository";
import type { Notification } from "@/lib/domain/notification";

const POLL_MS = 60_000;

function targetHref(n: Notification): string | null {
  const payload = n.payload;
  if (!payload) return null;
  if (n.type === "order_status" && typeof payload.orderId === "string") {
    return `/orders/${payload.orderId}`;
  }
  if ((n.type === "friend_request" || n.type === "friend_accepted") ) {
    return "/friends";
  }
  if (n.type === "message" && typeof payload.conversationId === "string") {
    return `/friends/${payload.conversationId}`;
  }
  return null;
}

// "Cạnh avatar tôi muốn có icon thông báo" — a bell next to UserMenu,
// reading the existing (previously dormant) `notifications` table
// (0001_init_schema.sql). Polls unread count rather than a realtime
// subscription — order-status changes (the first real publisher, see
// app/(store)/dashboard/orders/actions.ts) aren't frequent enough per user
// to need push delivery; the friends/messages side gets real Realtime
// where it actually matters (chat).
export function NotificationBell({ userId }: { userId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Notification[] | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function refreshCount() {
      const count = await countUnread(supabase, userId).catch(() => 0);
      if (!cancelled) setUnread(count);
    }

    refreshCount();
    const interval = setInterval(refreshCount, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userId]);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (!next) return;

    const supabase = createClient();
    const list = await listForUser(supabase, userId).catch(() => []);
    setItems(list);
    if (list.some((n) => !n.isRead)) {
      setUnread(0);
      markAllRead(supabase, userId).catch(() => {});
    }
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Thông báo"
        className="relative flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 max-h-[70vh] w-80 overflow-y-auto rounded-md border bg-popover shadow-lg">
          {items === null && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Đang tải...</p>
          )}
          {items && items.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Chưa có thông báo nào.</p>
          )}
          {items && items.length > 0 && (
            <ul className="divide-y">
              {items.map((n) => {
                const href = targetHref(n);
                const content = (
                  <>
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                  </>
                );
                return (
                  <li key={n.id} className={n.isRead ? "" : "bg-primary/5"}>
                    {href ? (
                      <Link href={href} onClick={() => setOpen(false)} className="block px-4 py-3 hover:bg-muted">
                        {content}
                      </Link>
                    ) : (
                      <div className="px-4 py-3">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
