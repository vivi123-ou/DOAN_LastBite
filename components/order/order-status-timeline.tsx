import { Circle } from "lucide-react";
import type { OrderStatusEvent } from "@/lib/domain/order";

// Same status→label map already duplicated across this app's order pages
// (orders/page.tsx, orders/[id]/page.tsx, dashboard/orders/page.tsx,
// dashboard/orders/actions.ts) — kept as its own small copy here too rather
// than a shared-import refactor of all four, matching this codebase's
// already-established pattern of small single-purpose duplicated maps over
// a bigger cross-cutting refactor.
const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ xác nhận",
  accepted: "Đã xác nhận",
  rejected: "Đã từ chối",
  preparing: "Đang chuẩn bị",
  ready: "Sẵn sàng",
  completed: "Hoàn tất",
  cancelled: "Đã huỷ",
};

// Shopee/Fahasa-style vertical status timeline — real recorded events
// (order_status_history, 0023) in newest-first order, not a fixed universal
// set of steps with some greyed out as "not reached yet": a rejected order
// only ever shows pending→rejected, it never implies a preparing/ready/
// completed step that will never happen. Shared between the customer order
// detail page and the store dashboard's order list — same component, same
// visual language on both sides of the same order.
export function OrderStatusTimeline({ events }: { events: OrderStatusEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">Chưa có lịch sử trạng thái.</p>;
  }

  return (
    <ol className="space-y-0">
      {events.map((event, index) => {
        const isLatest = index === 0;
        const isLast = index === events.length - 1;
        return (
          <li key={`${event.status}-${event.changedAt}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <Circle
                className={`size-3 shrink-0 ${
                  isLatest ? "fill-primary text-primary" : "fill-muted-foreground/40 text-muted-foreground/40"
                }`}
              />
              {!isLast && <div className="w-px flex-1 bg-border" />}
            </div>
            <div className={`pb-4 text-sm ${isLatest ? "" : "text-muted-foreground"}`}>
              <p className={isLatest ? "font-medium text-foreground" : ""}>
                {STATUS_LABEL[event.status] ?? event.status}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(event.changedAt).toLocaleString("vi-VN")}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
