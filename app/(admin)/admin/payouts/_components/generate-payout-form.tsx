"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { generatePayoutAction } from "@/app/(admin)/admin/payouts/actions";

function startOfMonthStr(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

export function GeneratePayoutForm({ stores }: { stores: { id: string; name: string }[] }) {
  const router = useRouter();
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [periodStart, setPeriodStart] = useState(startOfMonthStr());
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!storeId) {
      toast.error("Chọn một cửa hàng.");
      return;
    }
    setSubmitting(true);
    try {
      await generatePayoutAction({ storeId, periodStart, periodEnd });
      toast.success("Đã tạo phiếu đối soát.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-md border p-4">
      <div className="space-y-1.5">
        <Label htmlFor="payout-store">Cửa hàng</Label>
        <select
          id="payout-store"
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
          className="block rounded-md border px-2.5 py-1.5 text-sm"
        >
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="payout-from">Từ ngày</Label>
        <input
          id="payout-from"
          type="date"
          value={periodStart}
          onChange={(e) => setPeriodStart(e.target.value)}
          className="block rounded-md border px-2.5 py-1.5 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="payout-to">Đến ngày</Label>
        <input
          id="payout-to"
          type="date"
          value={periodEnd}
          onChange={(e) => setPeriodEnd(e.target.value)}
          className="block rounded-md border px-2.5 py-1.5 text-sm"
        />
      </div>
      <Button type="submit" disabled={submitting || stores.length === 0}>
        {submitting ? "Đang tạo..." : "Tạo phiếu đối soát"}
      </Button>
    </form>
  );
}
