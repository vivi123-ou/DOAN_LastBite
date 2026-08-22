import { createAdminClient } from "@/lib/supabase/admin";
import { getOverviewStats } from "@/lib/repositories/admin.repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-primary">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default async function AdminOverviewPage() {
  // Layout already gated this whole subtree to profiles.role = 'admin' —
  // the admin client here is for the read itself (every stat spans every
  // store/customer, not just the admin's own rows), not an extra auth check.
  const stats = await getOverviewStats(createAdminClient());

  return (
    <div className="space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Tổng quan hệ thống</h1>
        <p className="text-sm text-muted-foreground">
          Số liệu tổng hợp toàn hệ thống, tính đến thời điểm hiện tại.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Tổng người dùng" value={stats.totalUsers.toLocaleString("vi-VN")} />
        <StatCard
          label="Tổng cửa hàng"
          value={stats.totalStores.toLocaleString("vi-VN")}
          hint={`${stats.verifiedStores} đã duyệt · ${stats.pendingStores} chờ duyệt`}
        />
        <StatCard
          label="Báo cáo chưa xử lý"
          value={stats.openReportsCount.toLocaleString("vi-VN")}
        />
        <StatCard
          label="Tổng đơn hàng"
          value={stats.totalOrders.toLocaleString("vi-VN")}
          hint={`${stats.completedOrders} đã hoàn tất`}
        />
        <StatCard
          label="Doanh thu đơn hàng (đơn hoàn tất)"
          value={`${stats.totalRevenue.toLocaleString("vi-VN")}đ`}
        />
        <StatCard
          label="Doanh thu gói dịch vụ"
          value={`${stats.subscriptionRevenue.toLocaleString("vi-VN")}đ`}
        />
        <StatCard
          label="Hoa hồng tháng này"
          value={`${stats.commissionRevenueThisMonth.toLocaleString("vi-VN")}đ`}
          hint="Xem chi tiết theo cửa hàng ở mục Hoa hồng"
        />
        <StatCard
          label="Doanh thu quảng cáo"
          value={`${stats.adRevenue.toLocaleString("vi-VN")}đ`}
          hint="Xem chi tiết ở mục Quảng cáo"
        />
        <StatCard
          label="CO2 đã giảm"
          value={`${stats.totalCo2SavedKg.toFixed(1)} kg`}
          hint={`≈ ${stats.totalFoodRescuedKg.toFixed(1)} kg thực phẩm được giải cứu`}
        />
      </div>
    </div>
  );
}
