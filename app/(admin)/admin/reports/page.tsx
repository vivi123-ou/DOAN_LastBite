import { createAdminClient } from "@/lib/supabase/admin";
import { listReportsForAdmin } from "@/lib/repositories/admin.repository";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResolveReportButton } from "@/app/(admin)/admin/reports/_components/resolve-report-button";

// Reads combo_reviews where kind = 'report' — filed by customers from the
// order detail page (review-form.tsx), previously only ever visible to the
// customer who filed it and the store owner it's about (0015's RLS). This
// is the first place an admin can see them across the whole system.
export default async function AdminReportsPage() {
  const reports = await listReportsForAdmin(createAdminClient());
  const open = reports.filter((r) => !r.resolvedAt);
  const resolved = reports.filter((r) => r.resolvedAt);

  return (
    <div className="space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Báo cáo & khiếu nại</h1>
        <p className="text-sm text-muted-foreground">
          Khách hàng báo cáo vấn đề với combo từ trang chi tiết đơn hàng đã hoàn tất.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Chưa xử lý ({open.length})</h2>
        {open.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Không có báo cáo nào.</p>
        ) : (
          <div className="space-y-3">
            {open.map((r) => (
              <Card key={r.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {r.comboName} <span className="text-muted-foreground">— {r.storeName}</span>
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString("vi-VN")}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Khách hàng: {r.customerName ?? "—"}
                  </p>
                  {r.comment && <p className="rounded-md border bg-muted/40 p-2 text-sm">{r.comment}</p>}
                  <ResolveReportButton reportId={r.id} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {resolved.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Đã xử lý ({resolved.length})
          </h2>
          <div className="space-y-3">
            {resolved.map((r) => (
              <Card key={r.id} className="opacity-70">
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {r.comboName} <span className="text-muted-foreground">— {r.storeName}</span>
                    </p>
                    <Badge variant="outline">Đã xử lý</Badge>
                  </div>
                  {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
                  {r.adminNote && (
                    <p className="text-sm text-primary">Ghi chú xử lý: {r.adminNote}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
