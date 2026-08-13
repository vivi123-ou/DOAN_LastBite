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

export function OrderStatusActions({
  orderId,
  status,
  isPaid,
}: {
  orderId: string;
  status: OrderStatus;
  isPaid: boolean;
}) {
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

  // A completed order must have actually been paid — order.repository.ts's
  // updateStatus() enforces this server-side too (defense-in-depth, same
  // reasoning as re-validating stock/price at checkout), this is just the
  // client-side hint so the store owner sees *why* before clicking instead
  // of only after a failed attempt.
  const blockedByPayment = next.status === "completed" && !isPaid;

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <Button size="sm" disabled={isPending || blockedByPayment} onClick={() => handleUpdate(next.status)}>
          {next.label}
        </Button>
        <Button size="sm" variant="ghost" disabled={isPending} onClick={() => handleUpdate("cancelled")}>
          Huỷ đơn
        </Button>
      </div>
      {blockedByPayment && (
        <p className="text-xs text-destructive">Khách chưa thanh toán — chưa thể đánh dấu hoàn tất.</p>
      )}
    </div>
  );
}
