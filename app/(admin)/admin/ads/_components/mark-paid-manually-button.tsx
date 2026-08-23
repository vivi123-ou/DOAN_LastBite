"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { markBookingPaidManuallyAction } from "@/app/(admin)/admin/ads/actions";

// The real mechanism behind "xét duyệt thủ công bởi quản trị viên" — an
// admin explicitly reviews and confirms, rather than only ever activating
// on an automatic gateway webhook. Also the honest fallback when a gateway
// IPN genuinely doesn't arrive (a store already paid, an admin needs a way
// to unblock them without waiting on a gateway mystery) — same posture as
// /admin/payouts's existing "Đánh dấu đã trả" button for a different money
// flow in this app.
export function MarkPaidManuallyButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await markBookingPaidManuallyAction(bookingId, note);
      toast.success("Đã kích hoạt quảng cáo.");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Đánh dấu đã thanh toán
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <Textarea
        rows={2}
        placeholder="Ghi chú xác nhận (vd: đã nhận chuyển khoản thủ công)..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex gap-2">
        <Button size="sm" disabled={submitting} onClick={handleConfirm}>
          {submitting ? "Đang xác nhận..." : "Xác nhận"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Thôi
        </Button>
      </div>
    </div>
  );
}
