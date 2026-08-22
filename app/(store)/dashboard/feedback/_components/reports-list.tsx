"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Flag, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { respondToReportAction } from "@/app/(store)/dashboard/feedback/actions";
import type { ComboReview } from "@/lib/domain/review";

export function ReportsList({ reports }: { reports: ComboReview[] }) {
  return (
    <div className="space-y-3">
      {reports.map((r) => (
        <ReportCard key={r.id} report={r} />
      ))}
    </div>
  );
}

function ReportCard({ report }: { report: ComboReview }) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await respondToReportAction(report.id, draft);
      toast.success("Đã gửi phản hồi.");
      setDraft("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 font-medium">
            <Flag className="size-4 text-destructive" />
            {report.comboName}
          </p>
          <span className="text-xs text-muted-foreground">
            {new Date(report.createdAt).toLocaleString("vi-VN")}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">Khách hàng: {report.customerName ?? "Ẩn danh"}</p>
        {report.comment && <p className="rounded-md border bg-muted/40 p-2 text-sm">{report.comment}</p>}
        {report.imageUrls.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {report.imageUrls.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
              <img key={url} src={url} alt="" className="size-20 rounded-md border object-cover" />
            ))}
          </div>
        )}

        {report.resolvedAt && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <CheckCircle2 className="size-3.5" />
            Admin đã xử lý báo cáo này
          </p>
        )}

        {report.storeResponse ? (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-sm">
            <p className="font-medium text-primary">Phản hồi của bạn</p>
            <p>{report.storeResponse}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-2">
            <Textarea
              rows={2}
              placeholder="Phản hồi lại báo cáo này..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <Button type="submit" size="sm" disabled={submitting || !draft.trim()}>
              {submitting ? "Đang gửi..." : "Gửi phản hồi"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
