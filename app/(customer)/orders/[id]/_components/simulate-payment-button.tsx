"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  simulatePaymentAction,
  initiateMomoPaymentAction,
} from "@/app/(customer)/orders/[id]/actions";

type PaymentMethod = "vnpay" | "momo";

const METHODS: { id: PaymentMethod; label: string; className: string }[] = [
  { id: "vnpay", label: "VNPAY", className: "bg-[#005baa] text-white" },
  { id: "momo", label: "MoMo", className: "bg-[#a50064] text-white" },
];

// VNPay stays symbolic (no sandbox merchant credentials available yet —
// see CLAUDE.md). MoMo is wired to a real (sandbox) payment now — MoMo
// publishes a standing test partner in its public docs, no registration
// wait required, so it was the one that could actually be finished; see
// lib/payments/momo.ts. Picking VNPay still just calls the old
// simulatePaymentAction(); picking MoMo now calls initiateMomoPaymentAction()
// and redirects the whole page to MoMo's real hosted checkout — the order
// only actually gets marked paid once MoMo's IPN webhook confirms it
// (app/api/payments/momo/ipn/route.ts), not just because the browser came
// back to this page.
export function SimulatePaymentButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>("momo");
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      if (method === "momo") {
        const { payUrl } = await initiateMomoPaymentAction(orderId);
        window.location.href = payUrl;
        return;
      }
      await simulatePaymentAction(orderId, method);
      toast.success("Đã xác nhận thanh toán (giả lập).");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  }

  const selected = METHODS.find((m) => m.id === method)!;

  return (
    <div className="space-y-3 rounded-md border border-dashed p-4">
      <p className="text-sm text-muted-foreground">
        {method === "momo"
          ? "Thanh toán qua MoMo (môi trường thử nghiệm — sandbox, chưa phải giao dịch thật). Bạn sẽ được chuyển sang trang MoMo thật để hoàn tất."
          : "VNPay chưa được kết nối thật ở bản demo này. Chọn cổng khác hoặc xác nhận để giả lập thanh toán thành công."}
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
        {loading ? "Đang xử lý..." : `Thanh toán qua ${selected.label}`}
      </Button>
    </div>
  );
}
