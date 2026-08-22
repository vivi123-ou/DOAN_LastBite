"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StoreActions } from "@/app/(admin)/admin/stores/_components/store-actions";
import { bulkSetStoreVerificationAction } from "@/app/(admin)/admin/stores/actions";
import type { AdminStoreSummary } from "@/lib/domain/admin";

const VERIFICATION_LABEL: Record<string, string> = {
  pending: "Chờ duyệt",
  verified: "Đã duyệt",
  rejected: "Đã từ chối",
  suspended: "Tạm ngưng",
};

const VERIFICATION_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  verified: "default",
  rejected: "destructive",
  suspended: "destructive",
};

// Client component (not the page itself) purely so multi-select state
// (checkboxes + a bulk action bar) can live somewhere — the page.tsx that
// fetches the list stays a plain Server Component. Bulk approve is only
// offered for pending stores on the current page (checking a box on a
// store that's already verified/rejected wouldn't mean anything for a
// "duyệt" action) — reject-in-bulk was deliberately left out: rejecting is
// the one action here worth a moment's individual attention per store, not
// something to rubber-stamp across many at once.
export function StoresList({ stores }: { stores: AdminStoreSummary[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);

  const pendingStores = stores.filter((s) => s.verificationStatus === "pending");

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkApprove() {
    setPending(true);
    try {
      await bulkSetStoreVerificationAction([...selected], "verified");
      toast.success(`Đã duyệt ${selected.size} cửa hàng.`);
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      {pendingStores.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/30 p-3 text-sm">
          <span className="text-muted-foreground">
            {selected.size > 0 ? `${selected.size} đã chọn` : "Chọn cửa hàng chờ duyệt để duyệt hàng loạt"}
          </span>
          <Button size="sm" disabled={selected.size === 0 || pending} onClick={bulkApprove}>
            {pending ? "Đang duyệt..." : "Duyệt các mục đã chọn"}
          </Button>
        </div>
      )}

      {stores.map((store) => (
        <Card key={store.id}>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              {store.verificationStatus === "pending" && (
                <input
                  type="checkbox"
                  className="mt-1.5 size-4 shrink-0"
                  checked={selected.has(store.id)}
                  onChange={() => toggle(store.id)}
                  aria-label={`Chọn ${store.name}`}
                />
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/stores/${store.id}`} className="font-medium hover:underline">
                    {store.name}
                  </Link>
                  <Badge variant={VERIFICATION_VARIANT[store.verificationStatus]}>
                    {VERIFICATION_LABEL[store.verificationStatus]}
                  </Badge>
                  {!store.isActive && <Badge variant="destructive">Đã khoá</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  Chủ: {store.ownerName ?? "—"} · {store.addressLine}
                </p>
                <p className="text-xs text-muted-foreground">
                  Đăng ký {new Date(store.createdAt).toLocaleDateString("vi-VN")}
                </p>
              </div>
            </div>
            <StoreActions store={store} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
