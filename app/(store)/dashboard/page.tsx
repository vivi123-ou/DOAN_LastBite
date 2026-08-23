import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getStoreByOwnerId } from "@/lib/repositories/store.repository";
import { getStoreMonthlyStats, getPeakSellingHour } from "@/lib/repositories/order.repository";
import { checkAndNotifyComboExpiringSoon } from "@/lib/repositories/combo.repository";
import { getStoreStats } from "@/lib/repositories/review.repository";
import { getEffectiveSubscription } from "@/lib/repositories/subscription.repository";
import { getStoreImpact } from "@/lib/repositories/net-zero.repository";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flag, Star, Clock, Leaf, Sparkles } from "lucide-react";
import { StoreRegistrationForm } from "@/app/(store)/dashboard/_components/store-registration-form";
import type { ComboRatingSummary } from "@/lib/domain/review";

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

  // Same "missing table, not just a missing column" resilience exception
  // as combos/[id]/page.tsx — a store owner's whole dashboard overview
  // shouldn't 500 just because the review analytics add-on can't load yet.
  const admin = createAdminClient();
  const [stats, reviewStats, effective] = await Promise.all([
    getStoreMonthlyStats(supabase, store.id),
    getStoreStats(supabase, store.id).catch(() => ({ topRated: [], lowestRated: [], reportCount: 0 })),
    getEffectiveSubscription(admin, store.id),
  ]);

  // Basic+/Premium-only perks (0031) — fetched only when the store's tier
  // actually unlocks them, not computed then hidden, so a Free store never
  // pays the query cost for a report it can't see.
  const [peakHour, netZeroImpact] = await Promise.all([
    effective.tier !== "free" ? getPeakSellingHour(supabase, store.id) : Promise.resolve(null),
    effective.tier === "premium" ? getStoreImpact(supabase, store.id) : Promise.resolve(null),
  ]);

  // New Basic+ perk — lazy sweep, same no-cron posture as every other
  // time-based check in this app: only runs when the store owner actually
  // loads this page, not on a schedule. Fire-and-forget, never blocks the
  // dashboard render over a notification hiccup.
  if (effective.tier !== "free") {
    void checkAndNotifyComboExpiringSoon(admin, store.id).catch(() => {});
  }

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

      {(peakHour || netZeroImpact) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {peakHour && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <Clock className="size-4 text-primary" />
                  Khung giờ bán chạy nhất (30 ngày qua)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">{peakHour.hourLabel}</p>
                <p className="text-xs text-muted-foreground">{peakHour.orderCount} đơn trong khung giờ này</p>
              </CardContent>
            </Card>
          )}
          {netZeroImpact && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <Leaf className="size-4 text-primary" />
                  Tác động Net Zero của cửa hàng
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-2xl font-bold text-primary">
                  {netZeroImpact.totalCo2SavedKg.toFixed(1)} kg CO2
                </p>
                <p className="text-xs text-muted-foreground">
                  ≈ {netZeroImpact.totalFoodRescuedKg.toFixed(1)} kg thực phẩm được giải cứu qua{" "}
                  {netZeroImpact.orderCount} đơn đã thanh toán
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {effective.tier !== "premium" && (
        <Card className="border-dashed">
          <CardContent className="flex items-center gap-3 p-4">
            <Sparkles className="size-5 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              Nâng cấp lên <strong className="text-foreground">Premium</strong> để xem báo cáo
              tháng đầy đủ, tác động Net Zero của cửa hàng, và nhận gợi ý số lượng nhập hàng
              thông minh khi bán lại combo.{" "}
              <Link href="/dashboard/subscription" className="text-primary underline underline-offset-2">
                Xem các gói
              </Link>
            </p>
          </CardContent>
        </Card>
      )}

      {(reviewStats.topRated.length > 0 || reviewStats.reportCount > 0) && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Đánh giá sản phẩm</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {reviewStats.topRated.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-1.5 text-sm">
                    <Star className="size-4 fill-primary text-primary" />
                    Đánh giá tốt nhất
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {reviewStats.topRated.map((c: ComboRatingSummary) => (
                    <div key={c.comboId} className="flex items-center justify-between text-sm">
                      <span className="truncate">{c.comboName}</span>
                      <span className="shrink-0 font-medium text-primary">
                        {c.averageRating.toFixed(1)} ★ ({c.reviewCount})
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            {reviewStats.lowestRated.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-1.5 text-sm">
                    <Star className="size-4 text-muted-foreground" />
                    Cần cải thiện
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {reviewStats.lowestRated.map((c: ComboRatingSummary) => (
                    <div key={c.comboId} className="flex items-center justify-between text-sm">
                      <span className="truncate">{c.comboName}</span>
                      <span className="shrink-0 font-medium text-muted-foreground">
                        {c.averageRating.toFixed(1)} ★ ({c.reviewCount})
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            {reviewStats.reportCount > 0 && (
              <Card className="sm:col-span-2">
                <CardContent className="flex items-center gap-3 p-4">
                  <Flag className="size-5 text-destructive" />
                  <p className="text-sm">
                    <strong className="text-destructive">{reviewStats.reportCount}</strong> báo cáo
                    vấn đề từ khách hàng. Xem chi tiết ở lịch sử đơn hàng liên quan.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
