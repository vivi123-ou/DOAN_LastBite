"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateOrderStatusAction } from "@/app/(store)/dashboard/orders/actions";
import type { OrderStatus } from "@/lib/domain/order";

const NEXT_STEP: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  accepted: { status: "preparing", label: "Bắt đầu chuẩn bị" },
  preparing: { status: "ready", label: "Sẵn sàng lấy/giao" },
  ready: { status: "completed", label: "Hoàn tất đơn" },
};

export function OrderStatusActions({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const [isPending, startTransition] = useTransition();

  function handleUpdate(next: OrderStatus) {
    startTransition(async () => {
      try {
        await updateOrderStatusAction(orderId, next);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra.");
      }
    });
  }

  if (status === "pending") {
    return (
      <div className="flex gap-2">
        <Button size="sm" disabled={isPending} onClick={() => handleUpdate("accepted")}>
          Xác nhận đơn
        </Button>
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleUpdate("rejected")}>
          Từ chối
        </Button>
      </div>
    );
  }

  const next = NEXT_STEP[status];
  if (!next) return null;

  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={isPending} onClick={() => handleUpdate(next.status)}>
        {next.label}
      </Button>
      <Button size="sm" variant="ghost" disabled={isPending} onClick={() => handleUpdate("cancelled")}>
        Huỷ đơn
      </Button>
    </div>
  );
}
