import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getStoreByOwnerId } from "@/lib/repositories/store.repository";
import {
  getCommissionConfig,
  computeStoreCommissionEstimate,
  listPayoutsForStore,
} from "@/lib/repositories/commission.repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function startOfMonthIso(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default async function StoreRevenuePage() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login?next=/dashboard/revenue");

  const store = await getStoreByOwnerId(supabase, userId);
  if (!store) redirect("/dashboard");

  // Same "missing table degrades gracefully on a pre-existing critical page"
  // exception used elsewhere in this app (combo_reviews, order_status_history)
  // — this whole page is new UI for this feature though, so it's actually
  // fine to just let it error normally until 0028 is applied; no .catch()
  // needed since /dashboard itself doesn't depend on any of this.
  const [config, monthEstimate, payouts] = await Promise.all([
    getCommissionConfig(supabase),
    computeStoreCommissionEstimate(supabase, store.id, startOfMonthIso(), tomorrowIso()),
    listPayoutsForStore(supabase, store.id),
  ]);

  return (
    <div className="space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Doanh thu & hoa hồng</h1>
        <p className="text-sm text-muted-foreground">
          LastBite thu hoa hồng {config.commissionPct}% trên mỗi đơn hàng đã hoàn tất. Số dưới đây là
          ước tính trực tiếp từ đơn hàng — phiếu đối soát chính thức do LastBite tạo khi đến kỳ thanh
          toán, xem lịch sử bên dưới.
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Ước tính tháng này</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{monthEstimate.orderCount}</p>
              <p className="text-xs text-muted-foreground">Đơn hoàn tất</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{monthEstimate.grossRevenue.toLocaleString("vi-VN")}đ</p>
              <p className="text-xs text-muted-foreground">Doanh thu gộp</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-destructive">
                {monthEstimate.commissionAmount.toLocaleString("vi-VN")}đ
              </p>
              <p className="text-xs text-muted-foreground">Hoa hồng ({config.commissionPct}%)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-primary">
                {monthEstimate.netPayoutAmount.toLocaleString("vi-VN")}đ
              </p>
              <p className="text-xs text-muted-foreground">Thực nhận (ước tính)</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Lịch sử đối soát</h2>
        <div className="space-y-3">
          {payouts.map((p) => (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
                <CardTitle className="text-sm font-medium">
                  {new Date(p.periodStart).toLocaleDateString("vi-VN")} –{" "}
                  {new Date(p.periodEnd).toLocaleDateString("vi-VN")}
                </CardTitle>
                <Badge variant={p.status === "paid" ? "default" : "secondary"}>
                  {p.status === "paid" ? "Đã trả" : "Chờ thanh toán"}
                </Badge>
              </CardHeader>
              <CardContent className="text-sm">
                {p.orderCount} đơn · Doanh thu gộp {p.grossRevenue.toLocaleString("vi-VN")}đ · Hoa hồng{" "}
                {p.commissionAmount.toLocaleString("vi-VN")}đ · Thực nhận{" "}
                <strong className="text-primary">{p.netPayoutAmount.toLocaleString("vi-VN")}đ</strong>
                {p.paidAt && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Đã thanh toán lúc {new Date(p.paidAt).toLocaleString("vi-VN")}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
          {payouts.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">
              Chưa có phiếu đối soát nào cho cửa hàng của bạn.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
