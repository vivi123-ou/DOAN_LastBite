"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { resolveReportAction } from "@/app/(admin)/admin/reports/actions";

export function ResolveReportButton({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  async function handleResolve() {
    setPending(true);
    try {
      await resolveReportAction(reportId, note);
      toast.success("Đã đánh dấu xử lý.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Đánh dấu đã xử lý
      </Button>
    );
  }

  return (
    <div className="w-full space-y-2 sm:max-w-sm">
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Ghi chú xử lý (tuỳ chọn)..."
        rows={2}
      />
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={handleResolve}>
          {pending ? "Đang lưu..." : "Xác nhận"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Huỷ
        </Button>
      </div>
    </div>
  );
}
