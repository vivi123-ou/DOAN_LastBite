"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, History } from "lucide-react";
import { OrderStatusTimeline } from "@/components/order/order-status-timeline";
import type { OrderStatusEvent } from "@/lib/domain/order";

// Collapsed by default — a store's order list can get long, and showing a
// full timeline inline on every single card at once would be heavier than
// what the store owner actually needs most of the time (the current status
// badge already says that). Same OrderStatusTimeline the customer's order
// detail page uses, just tucked behind a toggle here instead of always
// visible on its own dedicated page.
export function OrderStatusHistoryToggle({ events }: { events: OrderStatusEvent[] }) {
  const [open, setOpen] = useState(false);

  if (events.length === 0) return null;

  return (
    <div className="border-t pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <History className="size-3.5" />
        Lịch sử trạng thái
        {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
      </button>
      {open && (
        <div className="pt-3">
          <OrderStatusTimeline events={events} />
        </div>
      )}
    </div>
  );
}
