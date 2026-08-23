"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reconcileVnpayBookingAction } from "@/app/(admin)/admin/ads/actions";

// The primary reconciliation action — asks VNPay directly (querydr) whether
// this specific transaction actually succeeded, rather than guessing.
// Should be tried before ever reaching for "Đánh dấu đã thanh toán" (the
// manual, no-real-verification fallback).
export function ReconcileVnpayButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleCheck() {
    setPending(true);
    try {
      const result = await reconcileVnpayBookingAction(bookingId);
      if (result.succeeded) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={handleCheck}>
      {pending ? "Đang tra cứu..." : "Kiểm tra với VNPay"}
    </Button>
  );
}
