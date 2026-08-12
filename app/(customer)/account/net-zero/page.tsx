import { redirect } from "next/navigation";
import { Leaf, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getSummary } from "@/lib/repositories/net-zero.repository";
import { Card, CardContent } from "@/components/ui/card";
import { VND_PER_POINT } from "@/lib/pricing/net-zero/net-zero.policy";

// No tier/VIP system here on purpose — just a running points balance and
// its VND-equivalent, plus the kg-CO2-saved stat the dormant net_zero_ledger
// (0001) was originally built for. A progress bar toward a "next tier"
// would need a tier system that doesn't exist; showing one anyway would be
// exactly the kind of misleading UI .claude/rules/business-rules.md's
// "no mystery bags" spirit argues against elsewhere in this app.
export default async function NetZeroPage() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login?next=/account/net-zero");

  const { pointsBalance, totalCo2SavedKg } = await getSummary(supabase, userId);
  const vndValue = pointsBalance * VND_PER_POINT;

  return (
    <div className="space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold">Điểm Net Zero</h1>
        <p className="text-sm text-muted-foreground">
          Mỗi đơn hàng thành công tích điểm theo giá trị đơn — dùng điểm để giảm giá cho lần mua
          tiếp theo.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-700 to-primary p-6 text-white">
          <div className="flex items-center gap-2 text-sm font-medium text-white/90">
            <Leaf className="size-4" />
            Điểm khả dụng
          </div>
          <p className="mt-2 text-4xl font-bold">{pointsBalance.toLocaleString("vi-VN")} điểm</p>
          <p className="mt-1 text-white/90">≈ {vndValue.toLocaleString("vi-VN")}đ</p>
        </div>
        <CardContent className="space-y-1.5 p-4 text-sm text-muted-foreground">
          <p>
            Quy đổi: <strong className="text-foreground">1 điểm Net Zero = {VND_PER_POINT.toLocaleString("vi-VN")}đ</strong>{" "}
            khi áp dụng giảm giá ở giỏ hàng.
          </p>
          <p>
            Tích điểm: cứ mỗi <strong className="text-foreground">1.000đ</strong> chi tiêu (sau khi
            thanh toán thành công) bạn nhận <strong className="text-foreground">1 điểm</strong>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="size-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">{totalCo2SavedKg.toFixed(1)} kg</p>
            <p className="text-sm text-muted-foreground">
              CO2 bạn đã giúp tránh phát thải nhờ mua combo cuối ngày thay vì để bị bỏ đi.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
