import { createAdminClient } from "@/lib/supabase/admin";
import { listAllPlansForAdmin } from "@/lib/repositories/subscription.repository";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreatePlanForm } from "@/app/(admin)/admin/plans/_components/create-plan-form";
import { PlanActiveToggle } from "@/app/(admin)/admin/plans/_components/plan-active-toggle";

export default async function AdminPlansPage() {
  const plans = await listAllPlansForAdmin(createAdminClient());

  return (
    <div className="space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Gói dịch vụ</h1>
        <p className="text-sm text-muted-foreground">
          Quản lý danh sách gói phí bán cho cửa hàng. Tắt 1 gói sẽ ẩn khỏi trang mua gói của cửa
          hàng, không ảnh hưởng cửa hàng đang dùng gói đó.
        </p>
      </div>

      <CreatePlanForm />

      <div className="space-y-3">
        {plans.map((plan) => (
          <Card key={plan.id}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{plan.name}</p>
                  {plan.isDefault && <Badge variant="outline">Mặc định</Badge>}
                  {!plan.isActive && <Badge variant="secondary">Đã ẩn</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {plan.price.toLocaleString("vi-VN")}đ / {plan.durationDays} ngày ·{" "}
                  {plan.maxActiveCombos === null
                    ? "không giới hạn combo"
                    : `tối đa ${plan.maxActiveCombos} combo`}
                </p>
                {plan.description && (
                  <p className="text-xs text-muted-foreground">{plan.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Đang bán</span>
                <PlanActiveToggle planId={plan.id} isActive={plan.isActive} />
              </div>
            </CardContent>
          </Card>
        ))}
        {plans.length === 0 && (
          <p className="py-10 text-center text-muted-foreground">Chưa có gói nào.</p>
        )}
      </div>
    </div>
  );
}
