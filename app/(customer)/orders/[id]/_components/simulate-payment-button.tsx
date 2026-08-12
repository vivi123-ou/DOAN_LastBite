"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { simulatePaymentAction } from "@/app/(customer)/orders/[id]/actions";

export function SimulatePaymentButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await simulatePaymentAction(orderId);
      toast.success("Đã xác nhận thanh toán (giả lập).");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-dashed p-4">
      <p className="text-sm text-muted-foreground">
        Thanh toán online qua VNPay/Momo chưa được kết nối thật ở bản demo này. Bấm nút dưới đây
        để giả lập thanh toán thành công.
      </p>
      <Button onClick={handleClick} disabled={loading} className="w-full">
        {loading ? "Đang xử lý..." : "Xác nhận thanh toán (giả lập)"}
      </Button>
    </div>
  );
}
