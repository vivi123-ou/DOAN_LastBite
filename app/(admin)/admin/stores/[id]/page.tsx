import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getStoreDetailForAdmin,
  listCombosForAdmin,
  listReportsForAdmin,
  listOrdersForStoreAdmin,
} from "@/lib/repositories/admin.repository";
import {
  getCurrentSubscriptionForStore,
  getEffectiveSubscription,
} from "@/lib/repositories/subscription.repository";
import { listPayoutsForAdmin } from "@/lib/repositories/commission.repository";
import { getBankAccount } from "@/lib/repositories/store.repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StoreActions } from "@/app/(admin)/admin/stores/_components/store-actions";

const VERIFICATION_LABEL: Record<string, string> = {
  pending: "Chờ duyệt",
  verified: "Đã duyệt",
  rejected: "Đã từ chối",
  suspended: "Tạm ngưng",
};

const VERIFICATION_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  verified: "default",
  rejected: "destructive",
  suspended: "destructive",
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Chờ xác nhận",
  accepted: "Đã nhận",
  preparing: "Đang chuẩn bị",
  ready: "Sẵn sàng",
  completed: "Hoàn tất",
  rejected: "Từ chối",
  cancelled: "Đã huỷ",
};

// One tab's worth of "everything about store X" in a single page — the
// point being an admin no longer has to separately search this store's
// name across /admin/combos, /admin/reports, and /admin/payouts one at a
// time (the exact gap flagged in the scaling checklist). Not paginated
// internally — each section shows a recent slice (20 rows), same "quick
// glance, not a full management view" posture as the read-only
// /admin/combos monitor.
export default async function AdminStoreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const store = await getStoreDetailForAdmin(admin, id);
  if (!store) notFound();

  const [combos, reports, orders, payouts, subscription, effective, bankAccount] = await Promise.all([
    listCombosForAdmin(admin, { storeId: id, page: 1 }),
    listReportsForAdmin(admin, { storeId: id, page: 1 }),
    listOrdersForStoreAdmin(admin, id),
    listPayoutsForAdmin(admin, { storeId: id, page: 1 }),
    getCurrentSubscriptionForStore(admin, id),
    getEffectiveSubscription(admin, id),
    getBankAccount(admin, id),
  ]);

  return (
    <div className="space-y-6 px-4 py-8">
      <Link href="/admin/stores" className="text-sm text-muted-foreground hover:underline">
        ← Danh sách cửa hàng
      </Link>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-2xl">{store.name}</CardTitle>
              <Badge variant={VERIFICATION_VARIANT[store.verificationStatus]}>
                {VERIFICATION_LABEL[store.verificationStatus]}
              </Badge>
              {!store.isActive && <Badge variant="destructive">Đã khoá</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              Chủ: {store.ownerName ?? "—"} · {store.addressLine}
            </p>
            <p className="text-xs text-muted-foreground">
              Đăng ký {new Date(store.createdAt).toLocaleDateString("vi-VN")}
            </p>
          </div>
          <StoreActions store={store} />
        </CardHeader>
        <CardContent className="text-sm">
          <p>
            Gói hiện tại: <strong>{effective.planName}</strong>
            {effective.locked && <span className="ml-1.5 text-destructive">(đã hết hạn, đang khoá)</span>}
            {subscription?.status === "pending_payment" && (
              <span className="ml-1.5 text-muted-foreground">(có đơn mua gói chưa thanh toán)</span>
            )}
          </p>
          {effective.maxActiveCombos !== null && (
            <p className="text-muted-foreground">Giới hạn {effective.maxActiveCombos} combo đang bán.</p>
          )}
          <p className="mt-2">
            Nhận thanh toán:{" "}
            {bankAccount?.accountNumber || bankAccount?.bankName ? (
              <>
                <strong>{bankAccount.bankName || "—"}</strong> ·{" "}
                <strong>{bankAccount.accountNumber || "—"}</strong> · {bankAccount.accountHolder || "—"}
              </>
            ) : (
              <span className="text-destructive">Chưa nhập thông tin ngân hàng</span>
            )}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Combo ({combos.totalCount})</h2>
          {combos.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Cửa hàng chưa có combo nào.</p>
          ) : (
            <div className="space-y-2">
              {combos.items.map((c) => (
                <Card key={c.id}>
                  <CardContent className="flex items-center justify-between p-3 text-sm">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-primary">{c.currentPrice.toLocaleString("vi-VN")}đ</span>
                  </CardContent>
                </Card>
              ))}
              {combos.totalCount > combos.items.length && (
                <Link
                  href={`/admin/combos?q=${encodeURIComponent(store.name)}`}
                  className="text-sm text-primary hover:underline"
                >
                  Xem tất cả {combos.totalCount} combo →
                </Link>
              )}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Đơn hàng gần đây</h2>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có đơn hàng nào.</p>
          ) : (
            <div className="space-y-2">
              {orders.map((o) => (
                <Card key={o.id}>
                  <CardContent className="flex items-center justify-between p-3 text-sm">
                    <span>
                      {o.customerName ?? "—"} ·{" "}
                      <span className="text-muted-foreground">
                        {new Date(o.createdAt).toLocaleDateString("vi-VN")}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span>{o.totalAmount.toLocaleString("vi-VN")}đ</span>
                      <Badge variant="outline">{ORDER_STATUS_LABEL[o.status] ?? o.status}</Badge>
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Báo cáo ({reports.totalCount})</h2>
          {reports.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có báo cáo nào.</p>
          ) : (
            <div className="space-y-2">
              {reports.items.map((r) => (
                <Card key={r.id}>
                  <CardContent className="space-y-1 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{r.comboName}</span>
                      <Badge variant={r.resolvedAt ? "outline" : "destructive"}>
                        {r.resolvedAt ? "Đã xử lý" : "Chưa xử lý"}
                      </Badge>
                    </div>
                    {r.comment && <p className="text-muted-foreground">{r.comment}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Đối soát ({payouts.totalCount})</h2>
          {payouts.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có phiếu đối soát nào.</p>
          ) : (
            <div className="space-y-2">
              {payouts.items.map((p) => (
                <Card key={p.id}>
                  <CardContent className="flex items-center justify-between p-3 text-sm">
                    <span>
                      {new Date(p.periodStart).toLocaleDateString("vi-VN")} –{" "}
                      {new Date(p.periodEnd).toLocaleDateString("vi-VN")}
                    </span>
                    <span className="flex items-center gap-2">
                      <span>{p.netPayoutAmount.toLocaleString("vi-VN")}đ</span>
                      <Badge variant={p.status === "paid" ? "default" : "secondary"}>
                        {p.status === "paid" ? "Đã trả" : "Chờ đối soát"}
                      </Badge>
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
