"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCommissionRateAction } from "@/app/(admin)/admin/commission/actions";

export function CommissionRateForm({ currentPct }: { currentPct: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(currentPct));
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateCommissionRateAction({ commissionPct: Number(value) });
      toast.success("Đã cập nhật tỷ lệ hoa hồng.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="commission-pct">Tỷ lệ hoa hồng (%)</Label>
        <Input
          id="commission-pct"
          type="number"
          min={0}
          max={100}
          step={0.5}
          className="w-32"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Đang lưu..." : "Cập nhật"}
      </Button>
    </form>
  );
}
