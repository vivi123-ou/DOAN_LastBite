import { createAdminClient } from "@/lib/supabase/admin";
import { getCommissionConfig, computeCommissionReport } from "@/lib/repositories/commission.repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CommissionRateForm } from "@/app/(admin)/admin/commission/_components/commission-rate-form";

function startOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export default async function AdminCommissionPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const periodStart = from || startOfMonth();
  // `to` is treated as inclusive by the date-picker UI but the report query
  // is exclusive-upper-bound (see computeCommissionReport) — add a day so a
  // picked end date's own orders are actually included.
  const periodEndExclusive = to
    ? new Date(new Date(to).getTime() + 86_400_000).toISOString().slice(0, 10)
    : tomorrow();

  const admin = createAdminClient();
  const [config, report] = await Promise.all([
    getCommissionConfig(admin),
    computeCommissionReport(admin, periodStart, periodEndExclusive),
  ]);

  const totalGross = report.reduce((sum, r) => sum + r.grossRevenue, 0);
  const totalCommission = report.reduce((sum, r) => sum + r.commissionAmount, 0);

  return (
    <div className="space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Hoa hồng & đối soát tài chính</h1>
        <p className="text-sm text-muted-foreground">
          Tỷ lệ hoa hồng áp dụng cho mọi đơn hàng hoàn tất trên toàn hệ thống. Doanh thu/hoa hồng bên
          dưới được tính trực tiếp từ đơn hàng đã hoàn tất trong khoảng thời gian chọn, chưa lưu lại
          cho tới khi bạn tạo phiếu đối soát ở mục{" "}
          <a href="/admin/payouts" className="underline">
            Đối soát
          </a>
          .
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tỷ lệ hoa hồng hiện tại</CardTitle>
        </CardHeader>
        <CardContent>
          <CommissionRateForm currentPct={config.commissionPct} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Báo cáo hoa hồng theo cửa hàng</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="space-y-1.5">
              <label htmlFor="from" className="text-xs text-muted-foreground">
                Từ ngày
              </label>
              <input
                id="from"
                name="from"
                type="date"
                defaultValue={periodStart}
                className="block rounded-md border px-2.5 py-1.5 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="to" className="text-xs text-muted-foreground">
                Đến ngày
              </label>
              <input
                id="to"
                name="to"
                type="date"
                defaultValue={to || new Date().toISOString().slice(0, 10)}
                className="block rounded-md border px-2.5 py-1.5 text-sm"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground"
            >
              Xem
            </button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">Cửa hàng</th>
                  <th className="py-2 pr-4">Số đơn</th>
                  <th className="py-2 pr-4">Doanh thu gộp</th>
                  <th className="py-2 pr-4">Hoa hồng ({config.commissionPct}%)</th>
                  <th className="py-2">Thực trả cửa hàng</th>
                </tr>
              </thead>
              <tbody>
                {report.map((r) => (
                  <tr key={r.storeId} className="border-b last:border-0">
                    <td className="py-2 pr-4">{r.storeName}</td>
                    <td className="py-2 pr-4">{r.orderCount}</td>
                    <td className="py-2 pr-4">{r.grossRevenue.toLocaleString("vi-VN")}đ</td>
                    <td className="py-2 pr-4 text-destructive">
                      {r.commissionAmount.toLocaleString("vi-VN")}đ
                    </td>
                    <td className="py-2 font-medium text-primary">
                      {r.netPayoutAmount.toLocaleString("vi-VN")}đ
                    </td>
                  </tr>
                ))}
                {report.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      Không có đơn hàng hoàn tất trong khoảng thời gian này.
                    </td>
                  </tr>
                )}
              </tbody>
              {report.length > 0 && (
                <tfoot>
                  <tr className="border-t font-medium">
                    <td className="py-2 pr-4">Tổng cộng</td>
                    <td className="py-2 pr-4">{report.reduce((s, r) => s + r.orderCount, 0)}</td>
                    <td className="py-2 pr-4">{totalGross.toLocaleString("vi-VN")}đ</td>
                    <td className="py-2 pr-4 text-destructive">
                      {totalCommission.toLocaleString("vi-VN")}đ
                    </td>
                    <td className="py-2 text-primary">
                      {(totalGross - totalCommission).toLocaleString("vi-VN")}đ
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
