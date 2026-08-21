"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markPayoutPaidAction } from "@/app/(admin)/admin/payouts/actions";

export function MarkPaidButton({ payoutId }: { payoutId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!window.confirm("Xác nhận đã chuyển khoản khoản đối soát này cho cửa hàng?")) return;
    setPending(true);
    try {
      await markPayoutPaidAction(payoutId);
      toast.success("Đã đánh dấu đã thanh toán.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={handleClick}>
      {pending ? "Đang lưu..." : "Đánh dấu đã trả"}
    </Button>
  );
}
