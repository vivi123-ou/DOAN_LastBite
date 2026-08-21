"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  initiateMomoSubscriptionPaymentAction,
  initiateVnpaySubscriptionPaymentAction,
} from "@/app/(store)/dashboard/subscription/actions";

// Same "pick a tile, redirect to the real gateway" shape as
// orders/[id]/_components/simulate-payment-button.tsx — reused pattern, not
// a new payment UI concept, just for a different purchase (a subscription
// plan instead of an order).
export function PlanPaymentButton({ planId, label }: { planId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<"momo" | "vnpay">("momo");
  const [loading, setLoading] = useState(false);

  async function handlePay() {
    setLoading(true);
    try {
      const { payUrl } =
        method === "momo"
          ? await initiateMomoSubscriptionPaymentAction(planId)
          : await initiateVnpaySubscriptionPaymentAction(planId);
      window.location.href = payUrl;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra.");
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMethod("momo")}
          className={`flex h-10 items-center justify-center rounded-md border-2 text-sm font-bold text-white transition-all ${
            method === "momo" ? "border-foreground" : "border-transparent opacity-60"
          } bg-[#a50064]`}
        >
          MoMo
        </button>
        <button
          type="button"
          onClick={() => setMethod("vnpay")}
          className={`flex h-10 items-center justify-center rounded-md border-2 text-sm font-bold text-white transition-all ${
            method === "vnpay" ? "border-foreground" : "border-transparent opacity-60"
          } bg-[#005baa]`}
        >
          VNPAY
        </button>
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={loading} onClick={handlePay} className="flex-1">
          {loading ? "Đang chuyển hướng..." : "Thanh toán"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Huỷ
        </Button>
      </div>
    </div>
  );
}
