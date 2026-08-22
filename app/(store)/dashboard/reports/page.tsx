import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles, Star, TrendingUp, Flag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getStoreByOwnerId } from "@/lib/repositories/store.repository";
import { getEffectiveSubscription } from "@/lib/repositories/subscription.repository";
import { getMonthlyStoreReport } from "@/lib/repositories/report.repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthPicker } from "@/app/(store)/dashboard/reports/_components/month-picker";

// Phase 4's "full Premium monthly report" — gated the same way every other
// Premium perk on this dashboard already is (getEffectiveSubscription's
// tier, not stores.tier directly — a locked/expired paid plan still keeps
// its tier's reporting perks per that function's own documented behavior).
export default async function MonthlyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login?next=/dashboard/reports");

  const store = await getStoreByOwnerId(supabase, userId);
  if (!store) redirect("/dashboard");

  const admin = createAdminClient();
  const effective = await getEffectiveSubscription(admin, store.id);

  const now = new Date();
  const year = Number((await searchParams).year) || now.getFullYear();
  const month = Number((await searchParams).month) || now.getMonth() + 1;

  if (effective.tier !== "premium") {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <h1 className="text-2xl font-bold">Báo cáo tháng</h1>
        <Card className="border-dashed">
          <CardContent className="flex items-center gap-3 p-4">
            <Sparkles className="size-5 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              Báo cáo tháng đầy đủ (doanh thu, hoa hồng, tác động Net Zero, sản phẩm bán chạy, đánh
              giá) là tính năng riêng của gói{" "}
              <strong className="text-foreground">Premium</strong>.{" "}
              <Link href="/dashboard/subscription" className="text-primary underline underline-offset-2">
                Xem các gói
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const report = await getMonthlyStoreReport(admin, store.id, year, month);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Báo cáo tháng {month}/{year}</h1>
          <p className="text-sm text-muted-foreground">Tổng hợp toàn bộ hoạt động của cửa hàng trong tháng.</p>
        </div>
        <MonthPicker year={year} month={month} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Đơn hoàn tất" value={report.orderCount.toLocaleString("vi-VN")} />
        <StatCard label="Doanh thu gộp" value={`${report.grossRevenue.toLocaleString("vi-VN")}đ`} />
        <StatCard
          label={`Hoa hồng (${report.commissionPct}%)`}
          value={`-${report.commissionAmount.toLocaleString("vi-VN")}đ`}
        />
        <StatCard label="Thực nhận" value={`${report.netRevenue.toLocaleString("vi-VN")}đ`} highlight />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" /> Tác động Net Zero trong tháng
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <p>
            Đã giảm <strong className="text-primary">{report.co2SavedKg.toFixed(1)}kg</strong> CO2
          </p>
          <p>
            Ước tính giải cứu <strong className="text-primary">{report.foodRescuedKg.toFixed(1)}kg</strong> thực
            phẩm
          </p>
        </CardContent>
      </Card>

      {report.topSellingCombos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-primary" /> Bán chạy nhất trong tháng
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {report.topSellingCombos.map((c) => (
              <div key={c.comboId} className="flex items-center justify-between">
                <span>{c.comboName}</span>
                <span className="text-muted-foreground">{c.unitsSold} phần</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {(report.topRatedCombos.length > 0 || report.reportCount > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {report.topRatedCombos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Star className="size-4 text-primary" /> Đánh giá tốt nhất
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {report.topRatedCombos.map((c) => (
                  <div key={c.comboId} className="flex items-center justify-between">
                    <span>{c.comboName}</span>
                    <span className="text-muted-foreground">{c.averageRating.toFixed(1)}★</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {report.reportCount > 0 && (
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Flag className="size-5 text-destructive" />
                <p className="text-sm">
                  <strong className="text-destructive">{report.reportCount}</strong> báo cáo trong
                  tháng này. Xem chi tiết ở lịch sử đơn hàng liên quan.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-bold ${highlight ? "text-primary" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
