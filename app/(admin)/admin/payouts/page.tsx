import { createAdminClient } from "@/lib/supabase/admin";
import { listPayoutsForAdmin } from "@/lib/repositories/commission.repository";
import { listVerified } from "@/lib/repositories/store.repository";
import type { PayoutStatus } from "@/lib/domain/commission";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { GeneratePayoutForm } from "@/app/(admin)/admin/payouts/_components/generate-payout-form";
import { MarkPaidButton } from "@/app/(admin)/admin/payouts/_components/mark-paid-button";

const VALID_STATUSES: PayoutStatus[] = ["pending", "paid"];

function parseStatus(raw: string | undefined): PayoutStatus | undefined {
  return VALID_STATUSES.find((s) => s === raw);
}

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status: rawStatus } = await searchParams;
  const status = parseStatus(rawStatus);
  const admin = createAdminClient();
  const [payouts, stores] = await Promise.all([
    listPayoutsForAdmin(admin, { search: q, status }),
    listVerified(admin, 200),
  ]);

  return (
    <div className="space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Đối soát & thanh toán cho cửa hàng</h1>
        <p className="text-sm text-muted-foreground">
          Mỗi phiếu là một lần chốt số cho một cửa hàng trong một khoảng thời gian (doanh thu gộp từ
          đơn hoàn tất, trừ hoa hồng). Chưa có kết nối chuyển khoản tự động (VietQR/PayOS/Casso) — sau
          khi chuyển khoản thủ công cho cửa hàng, đánh dấu phiếu là &quot;đã trả&quot; ở đây để lưu lại
          lịch sử đối soát.
        </p>
      </div>

      <GeneratePayoutForm stores={stores} />

      <AdminFilterBar
        searchPlaceholder="Tìm theo tên cửa hàng..."
        searchDefaultValue={q}
        selects={[
          {
            name: "status",
            defaultValue: rawStatus ?? "",
            options: [
              { value: "", label: "Tất cả trạng thái" },
              { value: "pending", label: "Chờ đối soát" },
              { value: "paid", label: "Đã trả" },
            ],
          },
        ]}
        hasActiveFilter={Boolean(q || status)}
      />

      <div className="space-y-3">
        {payouts.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{p.storeName}</p>
                  <Badge variant={p.status === "paid" ? "default" : "secondary"}>
                    {p.status === "paid" ? "Đã trả" : "Chờ đối soát"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {new Date(p.periodStart).toLocaleDateString("vi-VN")} –{" "}
                  {new Date(p.periodEnd).toLocaleDateString("vi-VN")} · {p.orderCount} đơn
                </p>
                <p className="text-sm">
                  Doanh thu gộp <strong>{p.grossRevenue.toLocaleString("vi-VN")}đ</strong> · Hoa hồng (
                  {p.commissionPct}%){" "}
                  <span className="text-destructive">{p.commissionAmount.toLocaleString("vi-VN")}đ</span> ·
                  Thực trả{" "}
                  <strong className="text-primary">{p.netPayoutAmount.toLocaleString("vi-VN")}đ</strong>
                </p>
                {p.paidAt && (
                  <p className="text-xs text-muted-foreground">
                    Đã trả lúc {new Date(p.paidAt).toLocaleString("vi-VN")}
                  </p>
                )}
              </div>
              {p.status === "pending" && <MarkPaidButton payoutId={p.id} />}
            </CardContent>
          </Card>
        ))}
        {payouts.length === 0 && (
          <p className="py-10 text-center text-muted-foreground">
            {q || status ? "Không tìm thấy phiếu đối soát nào khớp bộ lọc." : "Chưa có phiếu đối soát nào."}
          </p>
        )}
      </div>
    </div>
  );
}
