"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelBookingAction } from "@/app/(store)/dashboard/ads/actions";

// The store's own self-service cancel — only ever rendered for a
// 'pending_payment' row (page.tsx), matching the server-side rule in
// cancelOwnPendingBooking() that refuses to touch anything already active.
// No confirm dialog — nothing has actually been charged yet at this status,
// unlike unfriending or deleting a bulk-discount tier elsewhere in this app.
export function CancelPendingBookingButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleCancel() {
    setPending(true);
    try {
      await cancelBookingAction(bookingId);
      toast.success("Đã huỷ lượt mua quảng cáo.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra.");
      setPending(false);
    }
  }

  return (
    <Button size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={handleCancel}>
      {pending ? "Đang huỷ..." : "Huỷ"}
    </Button>
  );
}
