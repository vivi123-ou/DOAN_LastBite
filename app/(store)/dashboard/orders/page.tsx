import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getStoreByOwnerId } from "@/lib/repositories/store.repository";
import { listForStore, listStatusHistoryForOrders } from "@/lib/repositories/order.repository";
import { getEffectiveSubscription } from "@/lib/repositories/subscription.repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OrderStatusActions } from "@/app/(store)/dashboard/orders/_components/order-status-actions";
import { OrderStatusHistoryToggle } from "@/app/(store)/dashboard/orders/_components/order-status-history-toggle";
import { ExportCsvButton } from "@/app/(store)/dashboard/orders/_components/export-csv-button";
import type { OrderStatus } from "@/lib/domain/order";

const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ xác nhận",
  accepted: "Đã xác nhận",
  rejected: "Đã từ chối",
  preparing: "Đang chuẩn bị",
  ready: "Sẵn sàng",
  completed: "Hoàn tất",
  cancelled: "Đã huỷ",
};

const TABS: { value: OrderStatus | "all"; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "pending", label: "Chờ xác nhận" },
  { value: "accepted", label: "Đã xác nhận" },
  { value: "preparing", label: "Đang chuẩn bị" },
  { value: "ready", label: "Sẵn sàng" },
  { value: "completed", label: "Hoàn tất" },
];

export default async function StoreOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login?next=/dashboard/orders");

  const store = await getStoreByOwnerId(supabase, userId);
  if (!store) redirect("/dashboard");

  const activeStatus = status as OrderStatus | undefined;
  const [orders, effective] = await Promise.all([
    listForStore(supabase, store.id, activeStatus),
    getEffectiveSubscription(createAdminClient(), store.id),
  ]);
  // Same "missing table" resilience exception used elsewhere in this app
  // for new tables on pre-existing pages — degrades to no history shown
  // (the toggle just won't render) rather than 500ing the whole dashboard
  // if 0023 isn't applied yet.
  const statusHistoryByOrder = await listStatusHistoryForOrders(
    supabase,
    orders.map((o) => o.id)
  ).catch(() => new Map());

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Đơn hàng đến</h1>
        {effective.tier !== "free" && <ExportCsvButton orders={orders} />}
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value === "all" ? "/dashboard/orders" : `/dashboard/orders?status=${tab.value}`}
            className={`rounded-full border px-3 py-1 text-sm ${
              (activeStatus ?? "all") === tab.value
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:border-primary"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">Chưa có đơn hàng nào.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">
                    {order.customerName ?? "Khách hàng"}
                    {order.customerPhone && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        {order.customerPhone}
                      </span>
                    )}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {order.items.map((i) => `${i.comboName} x${i.quantity}`).join(", ")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {order.totalAmount.toLocaleString("vi-VN")}đ ·{" "}
                    {order.fulfillmentType === "pickup" ? "Tự đến lấy" : "Giao hàng"} ·{" "}
                    {new Date(order.createdAt).toLocaleString("vi-VN")}
                  </p>
                </div>
                <Badge variant="secondary">{STATUS_LABEL[order.status]}</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <OrderStatusActions
                  orderId={order.id}
                  status={order.status}
                  isPaid={order.paymentStatus === "success"}
                />
                <OrderStatusHistoryToggle events={statusHistoryByOrder.get(order.id) ?? []} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
