"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  initiateMomoPaymentAction,
  initiateVnpayPaymentAction,
} from "@/app/(customer)/orders/[id]/actions";

type PaymentMethod = "vnpay" | "momo";

const METHODS: { id: PaymentMethod; label: string; className: string }[] = [
  { id: "vnpay", label: "VNPAY", className: "bg-[#005baa] text-white" },
  { id: "momo", label: "MoMo", className: "bg-[#a50064] text-white" },
];

// Both gateways are real (sandbox) now — VNPay via the user's own registered
// sandbox merchant (lib/payments/vnpay.ts), MoMo via their publicly-published
// no-registration test merchant (lib/payments/momo.ts). Filename kept as
// "simulate-payment-button" (same import site, smaller diff) even though
// nothing here is simulated anymore — see CLAUDE.md for the round that
// retired simulatePaymentAction()/SimulatePaymentButton's old fake-success
// path entirely. Picking a tile redirects the whole page to that gateway's
// real hosted checkout; the order only actually gets marked paid once that
// gateway's IPN webhook confirms it — not just because the browser came
// back to this page.
export function SimulatePaymentButton({ orderId }: { orderId: string }) {
  const [method, setMethod] = useState<PaymentMethod>("momo");
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const { payUrl } =
        method === "momo"
          ? await initiateMomoPaymentAction(orderId)
          : await initiateVnpayPaymentAction(orderId);
      window.location.href = payUrl;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra.");
      setLoading(false);
    }
  }

  const selected = METHODS.find((m) => m.id === method)!;

  return (
    <div className="space-y-3 rounded-md border border-dashed p-4">
      <p className="text-sm text-muted-foreground">
        Thanh toán qua {selected.label} (môi trường thử nghiệm, chưa phải giao dịch thật). Bạn sẽ
        được chuyển sang trang thanh toán thật của {selected.label} để hoàn tất.
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
        {loading ? "Đang chuyển hướng..." : `Thanh toán qua ${selected.label}`}
      </Button>
    </div>
  );
}
