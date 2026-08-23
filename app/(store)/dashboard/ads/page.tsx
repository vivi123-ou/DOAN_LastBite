import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getStoreByOwnerId } from "@/lib/repositories/store.repository";
import { listByStore } from "@/lib/repositories/combo.repository";
import { listPlacementTypes, listBookingsForStore } from "@/lib/repositories/ad.repository";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, MousePointerClick } from "lucide-react";
import { AdBookingForm } from "@/app/(store)/dashboard/ads/_components/ad-booking-form";
import { CancelPendingBookingButton } from "@/app/(store)/dashboard/ads/_components/cancel-pending-booking-button";
import { PaymentReturnWatcher } from "@/components/payment/payment-return-watcher";
import { derivePaymentReturnStatus } from "@/lib/payments/return-status";

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Chờ thanh toán",
  active: "Đang chạy",
  expired: "Đã hết hạn",
  cancelled: "Đã huỷ",
};

// Admin module 3/3 (Quảng cáo & Vị trí Hiển thị) — the store-facing half.
// Deliberately its own separate mua-thêm product, not part of any
// subscription tier (see CLAUDE.md's "Advertising features" decision) — any
// store, on any plan including Free, can buy a slot here.
export default async function StoreAdsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login?next=/dashboard/ads");

  const store = await getStoreByOwnerId(supabase, userId);
  if (!store) redirect("/dashboard");

  // Same gateway-return gap as orders/[id]/page.tsx and
  // dashboard/subscription/page.tsx — see lib/payments/return-status.ts.
  const paymentReturnStatus = derivePaymentReturnStatus(await searchParams);

  const admin = createAdminClient();
  const [placementTypes, combos, bookings] = await Promise.all([
    listPlacementTypes(supabase),
    listByStore(supabase, store.id),
    listBookingsForStore(admin, store.id),
  ]);
  const activeCombos = combos.filter((c) => c.status === "active").map((c) => ({ id: c.id, name: c.name }));
  // No single booking id to check against the return redirect (VNPay/MoMo's
  // orderId here is per-attempt, not surfaced back to this page) — "no
  // booking still sitting pending_payment" is a reasonable proxy for "the
  // purchase that was just made already confirmed", good enough for a
  // handful of ad bookings per store.
  const noPendingBookings = bookings.every((b) => b.status !== "pending_payment");

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <PaymentReturnWatcher
        status={paymentReturnStatus}
        alreadyConfirmed={noPendingBookings}
        successMessage="Thanh toán thành công! Quảng cáo của bạn đang được kích hoạt."
        failureMessage="Thanh toán không thành công hoặc đã bị huỷ. Bạn có thể thử lại bên dưới."
      />
      <div>
        <h1 className="text-2xl font-bold">Quảng cáo</h1>
        <p className="text-sm text-muted-foreground">
          Mua vị trí hiển thị nổi bật cho combo hoặc cửa hàng của bạn. Tách biệt hoàn toàn với gói
          dịch vụ, mua khi cần, không ràng buộc gói.
        </p>
      </div>

      {activeCombos.length === 0 && placementTypes.some((t) => t.key !== "diamond_partner") && (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Bạn chưa có combo nào đang bán. Cần ít nhất một combo đang bán để mua nhãn HOT DEAL/Top
          tìm kiếm/Top ngành hàng.
        </p>
      )}

      <AdBookingForm storeId={store.id} placementTypes={placementTypes} combos={activeCombos} />

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Lịch sử quảng cáo</h2>
        {bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có quảng cáo nào.</p>
        ) : (
          <div className="space-y-2">
            {bookings.map((b) => (
              <Card key={b.id}>
                <CardContent className="space-y-1.5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {b.placementName}
                      {b.comboName && <span className="text-muted-foreground"> · {b.comboName}</span>}
                    </p>
                    <Badge variant={b.status === "active" ? "default" : "secondary"}>
                      {STATUS_LABEL[b.status] ?? b.status}
                    </Badge>
                  </div>
                  {b.startsAt && b.endsAt && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(b.startsAt).toLocaleDateString("vi-VN")} –{" "}
                      {new Date(b.endsAt).toLocaleDateString("vi-VN")}
                    </p>
                  )}
                  {b.status === "active" && (
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="size-3.5" /> {b.impressionCount} lượt xem
                      </span>
                      <span className="flex items-center gap-1">
                        <MousePointerClick className="size-3.5" /> {b.clickCount} lượt bấm
                      </span>
                    </div>
                  )}
                  {b.adminNote && (
                    <p className="text-xs text-destructive">Ghi chú từ admin: {b.adminNote}</p>
                  )}
                  {b.status === "pending_payment" && (
                    <div>
                      <CancelPendingBookingButton bookingId={b.id} />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
