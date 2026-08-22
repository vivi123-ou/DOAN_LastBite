"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cancelBookingAction } from "@/app/(admin)/admin/ads/actions";

// The actual mechanism behind "Đối tác Kim Cương độc quyền khu vực" — no
// real geo-exclusivity engine exists in this app, so an admin reviewing the
// diamond_partner list manually and cancelling an overlapping booking (with
// a note explaining why) IS the enforcement, same judgment-call posture
// this admin panel already leaves to a human elsewhere (e.g. store
// approve/reject).
export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleCancel() {
    setSubmitting(true);
    try {
      await cancelBookingAction(bookingId, note);
      toast.success("Đã huỷ quảng cáo.");
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
      <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>
        Huỷ quảng cáo
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <Textarea
        rows={2}
        placeholder="Lý do huỷ (hiển thị cho cửa hàng)..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex gap-2">
        <Button size="sm" variant="destructive" disabled={submitting} onClick={handleCancel}>
          {submitting ? "Đang huỷ..." : "Xác nhận huỷ"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Thôi
        </Button>
      </div>
    </div>
  );
}
