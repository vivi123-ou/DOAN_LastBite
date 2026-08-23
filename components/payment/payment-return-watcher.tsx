"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { PaymentReturnStatus } from "@/lib/payments/return-status";

// Renders nothing — pure side-effect component. Shows an immediate toast the
// instant the gateway redirect lands (verified signature already checked
// server-side, see lib/payments/return-status.ts), instead of the customer
// only finding out once the page re-renders with the IPN's eventual DB
// update. While the gateway said "success" but the page's own server data
// hasn't caught up yet (`alreadyConfirmed` false — the IPN webhook hasn't
// landed/been processed yet), it calls router.refresh() a few times a couple
// seconds apart so the real, authoritative status shows up on its own
// instead of the customer having to manually reload.
export function PaymentReturnWatcher({
  status,
  alreadyConfirmed,
  successMessage,
  failureMessage,
}: {
  status: PaymentReturnStatus;
  alreadyConfirmed: boolean;
  successMessage: string;
  failureMessage?: string;
}) {
  const router = useRouter();
  const toastShownRef = useRef(false);
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (status === "failed") {
      if (!toastShownRef.current) {
        toastShownRef.current = true;
        toast.error(failureMessage ?? "Thanh toán không thành công hoặc đã bị huỷ.");
      }
      return;
    }
    if (status !== "success") return;

    if (!toastShownRef.current) {
      toastShownRef.current = true;
      toast.success(successMessage);
    }
    // Real DB state (rendered server-side, above this component) already
    // reflects the payment — nothing left to poll for.
    if (alreadyConfirmed) return;
    // Bounded — a genuinely stuck IPN shouldn't poll forever; the page's
    // own real status (once it does arrive) is still correct even without
    // this, the customer would just need one manual reload at that point.
    if (attemptsRef.current >= 5) return;

    const timer = setTimeout(() => {
      attemptsRef.current += 1;
      router.refresh();
    }, 2000);
    return () => clearTimeout(timer);
  }, [status, alreadyConfirmed, successMessage, failureMessage, router]);

  return null;
}
