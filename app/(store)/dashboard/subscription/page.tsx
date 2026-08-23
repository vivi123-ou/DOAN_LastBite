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
import { PaymentReturnWatcher } from "@/components/payment/payment-return-watcher";
import { derivePaymentReturnStatus } from "@/lib/payments/return-status";

const TIER_LABEL: Record<SubscriptionTier, string> = {
  free: "Free",
  basic: "Basic",
  premium: "Premium",
};

// A real, exhaustive list of what each tier actually does — not just the
// combo-count number already shown separately. Each tier's list already
// includes everything the tier below it has (Premium = Basic's perks +
// its own), matching how the gating checks in dashboard/page.tsx,
// dashboard/combos/page.tsx, combos/[id]/page.tsx, and dashboard/reports
// actually work (tier !== 'free' for peak hour, tier === 'premium' for
// everything else). Written out explicitly per direct feedback — a bare
// "Tối đa N combo" line wasn't nearly enough detail to justify buying a
// paid plan.
const TIER_FEATURES: Record<SubscriptionTier, string[]> = {
  free: ["Đăng bán tối đa 5 combo cùng lúc", "Quản lý đơn hàng cơ bản"],
  basic: [
    "Mọi tính năng của Free",
    "Đăng bán tối đa 20 combo cùng lúc",
    "Xem khung giờ bán chạy nhất trong 30 ngày qua",
    "Cảnh báo khi combo sắp hết hạn mà còn nhiều hàng chưa bán",
    "Xuất danh sách đơn hàng ra file CSV để lưu sổ sách",
  ],
  premium: [
    "Mọi tính năng của Basic",
    "Không giới hạn số combo đang bán cùng lúc",
    "Báo cáo tác động Net Zero (kg CO2, kg thực phẩm) của cửa hàng",
    "Gợi ý số lượng nên nhập khi bán lại (dựa trên doanh số thực tế 7 ngày)",
    "Huy hiệu \"Đối tác Premium\" hiển thị trên trang combo",
    "Báo cáo doanh thu & hoa hồng đầy đủ theo tháng",
  ],
};

// Shown once under each tier's name, above its feature list — the one-line
// pitch for *why* someone upgrades, since the bullet list alone still reads
// as a flat feature dump rather than a reason to pay.
const TIER_PITCH: Record<SubscriptionTier, string> = {
  free: "Bắt đầu bán miễn phí, không cần thẻ.",
  basic: "Dành cho cửa hàng muốn bán nhiều hơn và không bỏ lỡ hàng sắp hết hạn.",
  premium: "Dành cho cửa hàng muốn tối ưu doanh thu và xây dựng thương hiệu xanh.",
};

// Ordered so the layout below reads Free → Basic → Premium regardless of
// exact insertion order in the DB.
const TIER_ORDER: SubscriptionTier[] = ["free", "basic", "premium"];

export default async function StoreSubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login?next=/dashboard/subscription");

  // Same gateway-return gap as orders/[id]/page.tsx — see
  // lib/payments/return-status.ts.
  const paymentReturnStatus = derivePaymentReturnStatus(await searchParams);

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

  // The one free-trial row (grantFreeTrialIfEligible, granted automatically
  // when an admin verifies the store) looks like any other active row
  // except amount_paid = 0 — flagged here purely for a clearer badge/label,
  // no different underlying entitlement than a real Premium purchase.
  const isTrialActive = current?.status === "active" && current.amountPaid === 0 && !effective.locked;

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
      <PaymentReturnWatcher
        status={paymentReturnStatus}
        alreadyConfirmed={current?.status === "active" && !effective.locked}
        successMessage="Thanh toán thành công! Gói dịch vụ của bạn đang được kích hoạt."
        failureMessage="Thanh toán không thành công hoặc đã bị huỷ. Bạn có thể thử lại bên dưới."
      />
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
            {isTrialActive && <Badge variant="outline">Dùng thử miễn phí</Badge>}
            {effective.locked && <Badge variant="destructive">Đã hết hạn, bị khoá</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {effective.maxActiveCombos === null
              ? "Không giới hạn số combo đang bán cùng lúc."
              : `Tối đa ${effective.maxActiveCombos} combo đang bán cùng lúc.`}
          </p>
          {effective.expiresAt && (
            <p className="text-sm text-muted-foreground">
              {effective.locked
                ? "Đã hết hạn vào"
                : isTrialActive
                  ? "Dùng thử miễn phí đến"
                  : "Hết hạn vào"}{" "}
              <strong>{new Date(effective.expiresAt).toLocaleDateString("vi-VN")}</strong>
              {effective.daysUntilExpiry !== null && effective.daysUntilExpiry >= 0 && (
                <> · còn {effective.daysUntilExpiry} ngày</>
              )}
            </p>
          )}
          {effective.locked && (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              Gói đã hết hạn. Không thể đăng combo mới cho tới khi gia hạn.
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
        <div className="grid items-start gap-4 sm:grid-cols-3">
          {TIER_ORDER.map((tier) => {
            // Premium visually elevated (scale + ring + "Phổ biến nhất"
            // badge) — direct answer to "khó nhìn quá, phân bổ sao cho hợp
            // lý": a flat 3-column grid where every column looks equally
            // weighted doesn't guide the eye anywhere, same "most popular"
            // treatment Claude's own pricing page (and most SaaS pricing
            // pages) use for the tier they actually want you to pick.
            const isFeatured = tier === "premium";
            return (
              <div
                key={tier}
                className={`space-y-3 rounded-lg p-3 ${
                  isFeatured ? "border-2 border-primary bg-primary/5 sm:scale-105" : ""
                }`}
              >
                <div className="text-center">
                  {isFeatured && <Badge className="mb-1.5">Phổ biến nhất</Badge>}
                  <h3 className="text-base font-bold">{TIER_LABEL[tier]}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{TIER_PITCH[tier]}</p>
                </div>
                {/* Shared across every plan (monthly/yearly) within this
                    tier — the feature set is the same regardless of
                    billing period, only price/duration differ per plan
                    card below. The combo-count cap now lives only here
                    (dropped from each plan card below to stop repeating
                    the same line twice on screen). */}
                <ul className="space-y-1.5 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                  {TIER_FEATURES[tier].map((feature) => (
                    <li key={feature} className="flex items-start gap-1.5">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
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
                        {plan.description && (
                          <p className="text-xs text-muted-foreground">{plan.description}</p>
                        )}
                        {plan.price > 0 && (
                          <PlanPaymentButton
                            planId={plan.id}
                            label={isCurrent ? "Gia hạn" : "Chọn gói này"}
                            priceLabel={`${plan.price.toLocaleString("vi-VN")}đ (gói ${TIER_LABEL[plan.tier]}, ${
                              plan.durationDays >= 365 ? "theo năm" : "theo tháng"
                            })`}
                          />
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          &ldquo;Gia hạn&rdquo; chỉ mở bảng chọn MoMo/VNPAY và luôn hỏi xác nhận số tiền trước khi
          chuyển sang cổng thanh toán thật — bấm nhầm không bị trừ tiền ngay. LastBite chưa hỗ trợ
          tự động gia hạn: nếu không bấm &ldquo;Gia hạn&rdquo;, gói sẽ tự hết hạn và cửa hàng quay
          về Free, không cần huỷ gì thêm.
        </p>
      </div>
    </div>
  );
}
