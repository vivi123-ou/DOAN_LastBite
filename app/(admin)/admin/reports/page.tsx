import { createAdminClient } from "@/lib/supabase/admin";
import { listReportsForAdmin } from "@/lib/repositories/admin.repository";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { OpenReportsList } from "@/app/(admin)/admin/reports/_components/open-reports-list";

// Reads combo_reviews where kind = 'report' — filed by customers from the
// order detail page (review-form.tsx), previously only ever visible to the
// customer who filed it and the store owner it's about (0015's RLS). This
// is the first place an admin can see them across the whole system.
export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; resolved?: string; page?: string }>;
}) {
  const { q, resolved: rawResolved, page: rawPage } = await searchParams;
  const resolved = rawResolved === "open" || rawResolved === "resolved" ? rawResolved : undefined;
  const page = Number(rawPage) > 0 ? Number(rawPage) : 1;
  const { items: reports, totalCount } = await listReportsForAdmin(createAdminClient(), {
    search: q,
    resolved,
    page,
  });
  const open = reports.filter((r) => !r.resolvedAt);
  const resolvedList = reports.filter((r) => r.resolvedAt);

  return (
    <div className="space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Báo cáo & khiếu nại</h1>
        <p className="text-sm text-muted-foreground">
          Khách hàng báo cáo vấn đề với combo từ trang chi tiết đơn hàng đã hoàn tất. {totalCount} báo
          cáo khớp bộ lọc.
        </p>
      </div>

      <AdminFilterBar
        searchPlaceholder="Tìm theo combo, cửa hàng, khách hàng, nội dung..."
        searchDefaultValue={q}
        selects={[
          {
            name: "resolved",
            defaultValue: rawResolved ?? "",
            options: [
              { value: "", label: "Tất cả" },
              { value: "open", label: "Chưa xử lý" },
              { value: "resolved", label: "Đã xử lý" },
            ],
          },
        ]}
        hasActiveFilter={Boolean(q || resolved)}
      />

      {resolved !== "resolved" && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Chưa xử lý (trang này: {open.length})
          </h2>
          {open.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {q ? "Không tìm thấy báo cáo nào khớp." : "Không có báo cáo nào."}
            </p>
          ) : (
            <OpenReportsList reports={open} />
          )}
        </section>
      )}

      {resolved !== "open" && resolvedList.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Đã xử lý (trang này: {resolvedList.length})
          </h2>
          <div className="space-y-3">
            {resolvedList.map((r) => (
              <Card key={r.id} className="opacity-70">
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {r.comboName} <span className="text-muted-foreground">· {r.storeName}</span>
                    </p>
                    <Badge variant="outline">Đã xử lý</Badge>
                  </div>
                  {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
                  {r.storeResponse && (
                    <p className="text-sm">
                      <span className="font-medium text-primary">Phản hồi từ cửa hàng: </span>
                      {r.storeResponse}
                    </p>
                  )}
                  {r.adminNote && (
                    <p className="text-sm text-primary">Ghi chú xử lý: {r.adminNote}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <AdminPagination
        page={page}
        pageSize={20}
        totalCount={totalCount}
        searchParams={{ q, resolved: rawResolved }}
      />
    </div>
  );
}
