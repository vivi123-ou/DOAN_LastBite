"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setStoreVerificationAction, setStoreActiveAction } from "@/app/(admin)/admin/stores/actions";
import type { AdminStoreSummary } from "@/lib/domain/admin";

export function StoreActions({ store }: { store: AdminStoreSummary }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run(fn: () => Promise<void>) {
    setPending(true);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {store.verificationStatus === "pending" && (
        <>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(() => setStoreVerificationAction(store.id, "verified"))}
          >
            Duyệt
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => setStoreVerificationAction(store.id, "rejected"))}
          >
            Từ chối
          </Button>
        </>
      )}
      {store.verificationStatus !== "pending" && store.verificationStatus !== "verified" && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => setStoreVerificationAction(store.id, "verified"))}
        >
          Duyệt lại
        </Button>
      )}
      <Button
        size="sm"
        variant={store.isActive ? "ghost" : "outline"}
        disabled={pending}
        onClick={() => run(() => setStoreActiveAction(store.id, !store.isActive))}
      >
        {store.isActive ? "Khoá cửa hàng" : "Mở khoá"}
      </Button>
    </div>
  );
}
