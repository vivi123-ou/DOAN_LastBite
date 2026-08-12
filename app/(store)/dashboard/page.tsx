import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getStoreByOwnerId } from "@/lib/repositories/store.repository";
import { getStoreMonthlyStats } from "@/lib/repositories/order.repository";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StoreRegistrationForm } from "@/app/(store)/dashboard/_components/store-registration-form";

const STATUS_LABEL: Record<string, string> = {
  pending: "Đang chờ xác minh",
  verified: "Đã xác minh",
  rejected: "Bị từ chối",
  suspended: "Tạm ngưng",
};

const STATUS_VARIANT: Record<string, "secondary" | "default" | "destructive"> = {
  pending: "secondary",
  verified: "default",
  rejected: "destructive",
  suspended: "destructive",
};

export default async function StoreDashboardPage() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login?next=/dashboard");

  const store = await getStoreByOwnerId(supabase, userId);

  if (!store) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <StoreRegistrationForm />
      </div>
    );
  }

  const stats = await getStoreMonthlyStats(supabase, store.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-2xl">{store.name}</CardTitle>
            <CardDescription>{store.addressLine}</CardDescription>
          </div>
          <Badge variant={STATUS_VARIANT[store.verificationStatus]}>
            {STATUS_LABEL[store.verificationStatus]}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {store.verificationStatus === "pending" && (
            <p className="text-sm text-muted-foreground">
              Cửa hàng của bạn đang chờ xác minh. Bạn có thể chuẩn bị combo trước, nhưng combo chỉ
              hiển thị công khai sau khi cửa hàng được xác minh.
            </p>
          )}
          {store.verificationStatus === "rejected" && (
            <p className="text-sm text-destructive">
              Hồ sơ cửa hàng bị từ chối. Vui lòng liên hệ đội ngũ LastBite để biết thêm chi tiết.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              nativeButton={false}
              render={<Link href="/dashboard/combos">Quản lý combo</Link>}
            />
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/dashboard/orders">Đơn hàng đến</Link>}
            />
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Thống kê tháng này</h2>
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{stats.orderCount}</p>
              <p className="text-xs text-muted-foreground">Đơn hàng</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{stats.completedOrderCount}</p>
              <p className="text-xs text-muted-foreground">Đã hoàn tất</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-primary">
                {stats.revenue.toLocaleString("vi-VN")}đ
              </p>
              <p className="text-xs text-muted-foreground">Doanh thu</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
