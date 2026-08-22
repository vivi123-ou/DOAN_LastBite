"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResolveReportButton } from "@/app/(admin)/admin/reports/_components/resolve-report-button";
import { bulkResolveReportsAction } from "@/app/(admin)/admin/reports/actions";
import type { AdminReportSummary } from "@/lib/domain/admin";

// Bulk-resolve bar + per-row checkboxes, same shape as stores/_components/
// stores-list.tsx's bulk-approve — a client component wrapping just the
// "chưa xử lý" section, since that's the only one bulk actions make sense
// for (an already-resolved report has nothing left to bulk-do).
export function OpenReportsList({ reports }: { reports: AdminReportSummary[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkResolve() {
    setPending(true);
    try {
      await bulkResolveReportsAction([...selected]);
      toast.success(`Đã đánh dấu xử lý ${selected.size} báo cáo.`);
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
      <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/30 p-3 text-sm">
        <span className="text-muted-foreground">
          {selected.size > 0 ? `${selected.size} đã chọn` : "Chọn báo cáo để xử lý hàng loạt"}
        </span>
        <Button size="sm" disabled={selected.size === 0 || pending} onClick={bulkResolve}>
          {pending ? "Đang xử lý..." : "Đánh dấu đã xử lý"}
        </Button>
      </div>

      {reports.map((r) => (
        <Card key={r.id}>
          <CardContent className="flex items-start gap-3 p-4">
            <input
              type="checkbox"
              className="mt-1.5 size-4 shrink-0"
              checked={selected.has(r.id)}
              onChange={() => toggle(r.id)}
              aria-label={`Chọn báo cáo ${r.comboName}`}
            />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {r.comboName} <span className="text-muted-foreground">— {r.storeName}</span>
                </p>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleString("vi-VN")}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Khách hàng: {r.customerName ?? "—"}</p>
              {r.comment && <p className="rounded-md border bg-muted/40 p-2 text-sm">{r.comment}</p>}
              <ResolveReportButton reportId={r.id} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
