"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { simulatePaymentAction } from "@/app/(customer)/orders/[id]/actions";

type PaymentMethod = "vnpay" | "momo";

const METHODS: { id: PaymentMethod; label: string; className: string }[] = [
  { id: "vnpay", label: "VNPAY", className: "bg-[#005baa] text-white" },
  { id: "momo", label: "MoMo", className: "bg-[#a50064] text-white" },
];

// Symbolic VNPay/Momo checkout — no real gateway is wired up yet (see
// CLAUDE.md §7 "Next steps"). Picking a tile and confirming just calls the
// same simulatePaymentAction() the old single "giả lập thanh toán" button
// did; swapping in the real gateways later means adding a webhook route
// that calls order.repository.ts's markPaid() the same way, nothing else
// in this component changes.
export function SimulatePaymentButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>("vnpay");
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await simulatePaymentAction(orderId, method);
      toast.success("Đã xác nhận thanh toán (giả lập).");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-dashed p-4">
      <p className="text-sm text-muted-foreground">
        Thanh toán online qua VNPay/Momo chưa được kết nối thật ở bản demo này. Chọn cổng thanh
        toán rồi xác nhận để giả lập thanh toán thành công.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMethod(m.id)}
            className={`flex h-12 items-center justify-center rounded-md border-2 font-bold tracking-wide transition-all ${m.className} ${
              method === m.id ? "border-foreground" : "border-transparent opacity-60"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <Button onClick={handleClick} disabled={loading} className="w-full">
        {loading ? "Đang xử lý..." : `Thanh toán qua ${METHODS.find((m) => m.id === method)?.label}`}
      </Button>
    </div>
  );
}
