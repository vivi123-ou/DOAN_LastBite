import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getStoreByOwnerId } from "@/lib/repositories/store.repository";
import {
  listPlans,
  getCurrentSubscriptionForStore,
  getEffectiveSubscription,
  checkAndNotifyExpiringSoon,
} from "@/lib/repositories/subscription.repository";
import type { SubscriptionPlan, SubscriptionTier } from "@/lib/domain/subscription";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Check } from "lucide-react";
import { PlanPaymentButton } from "@/app/(store)/dashboard/subscription/_components/plan-payment-button";

const TIER_LABEL: Record<SubscriptionTier, string> = {
  free: "Free",
  basic: "Basic",
  premium: "Premium",
};

// Ordered so the layout below reads Free → Basic → Premium regardless of
// exact insertion order in the DB.
const TIER_ORDER: SubscriptionTier[] = ["free", "basic", "premium"];

export default async function StoreSubscriptionPage() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login?next=/dashboard/subscription");

  const store = await getStoreByOwnerId(supabase, userId);
  if (!store) redirect("/dashboard");

  const admin = createAdminClient();
  // Lazy sweep — fires the "sắp hết hạn" notification at most once per
  // subscription row, only when the store owner actually visits this page.
  // Same no-cron-infrastructure posture as every other time-based check in
  // this app; see subscription.repository.ts's own comment.
  await checkAndNotifyExpiringSoon(admin, store.id).catch(() => {});

  const [plans, current, effective] = await Promise.all([
    listPlans(supabase),
    getCurrentSubscriptionForStore(admin, store.id),
    getEffectiveSubscription(admin, store.id),
  ]);

  // Grouped by tier (not a flat list) — since 0031 added a yearly variant
  // alongside the existing monthly one for Basic/Premium, a flat 5-card
  // grid would read as 5 unrelated options instead of "3 tiers, 2 billing
  // choices each". Shortest duration first within a tier (monthly before
  // yearly) so the "Gia hạn"/"Chọn gói này" button order matches intuition.
  const plansByTier = new Map<SubscriptionTier, SubscriptionPlan[]>();
  for (const plan of plans) {
    const list = plansByTier.get(plan.tier) ?? [];
    list.push(plan);
    plansByTier.set(plan.tier, list);
  }
  for (const list of plansByTier.values()) {
    list.sort((a, b) => a.durationDays - b.durationDays);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Gói dịch vụ</h1>
        <p className="text-sm text-muted-foreground">
          Gói hiện tại quyết định số combo bạn được đăng bán cùng lúc và các tính năng báo cáo/gợi ý
          bạn được dùng.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gói đang dùng</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold text-primary">{effective.planName}</span>
            {effective.locked && <Badge variant="destructive">Đã hết hạn — bị khoá</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {effective.maxActiveCombos === null
              ? "Không giới hạn số combo đang bán cùng lúc."
              : `Tối đa ${effective.maxActiveCombos} combo đang bán cùng lúc.`}
          </p>
          {effective.expiresAt && (
            <p className="text-sm text-muted-foreground">
              {effective.locked ? "Đã hết hạn vào" : "Hết hạn vào"}{" "}
              <strong>{new Date(effective.expiresAt).toLocaleDateString("vi-VN")}</strong>
              {effective.daysUntilExpiry !== null && effective.daysUntilExpiry >= 0 && (
                <> — còn {effective.daysUntilExpiry} ngày</>
              )}
            </p>
          )}
          {effective.locked && (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              Gói đã hết hạn — không thể đăng combo mới cho tới khi gia hạn.
            </p>
          )}
          {current?.status === "pending_payment" && (
            <p className="text-sm text-muted-foreground">
              Có 1 giao dịch nâng cấp đang chờ thanh toán hoàn tất.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Các gói hiện có</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {TIER_ORDER.map((tier) => (
            <div key={tier} className="space-y-3">
              <h3 className="text-center text-sm font-semibold text-muted-foreground">
                {TIER_LABEL[tier]}
              </h3>
              {(plansByTier.get(tier) ?? []).map((plan) => {
                const isCurrent = plan.name === effective.planName && !effective.locked;
                return (
                  <Card key={plan.id} className={isCurrent ? "border-primary" : undefined}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between text-base">
                        {plan.durationDays >= 365 ? "Theo năm" : "Theo tháng"}
                        {isCurrent && (
                          <Badge>
                            <Check className="size-3" /> Đang dùng
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-2xl font-bold text-primary">
                        {plan.price.toLocaleString("vi-VN")}đ
                        <span className="text-sm font-normal text-muted-foreground">
                          /{plan.durationDays >= 365 ? "năm" : `${plan.durationDays} ngày`}
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {plan.maxActiveCombos === null
                          ? "Không giới hạn combo"
                          : `Tối đa ${plan.maxActiveCombos} combo`}
                      </p>
                      {plan.description && (
                        <p className="text-xs text-muted-foreground">{plan.description}</p>
                      )}
                      {plan.price > 0 && (
                        <PlanPaymentButton
                          planId={plan.id}
                          label={isCurrent ? "Gia hạn" : "Chọn gói này"}
                        />
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
