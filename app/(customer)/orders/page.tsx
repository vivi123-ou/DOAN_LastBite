import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Leaf } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { listForCustomer } from "@/lib/repositories/order.repository";
import { getImpactForOrders } from "@/lib/repositories/net-zero.repository";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

// Groups the 7 raw order statuses into inbook.vn-style tabs — a tab per
// exact status would be too many tiny/mostly-empty tabs for this app's
// scale; "Đang xử lý" covers the whole store-side fulfillment pipeline
// (accepted → preparing → ready) as one tab since that's one continuous
// "your order is being worked on" phase from the customer's perspective.
const TABS: { key: string; label: string; statuses: OrderStatus[] | null }[] = [
  { key: "all", label: "Tất cả", statuses: null },
  { key: "pending", label: "Chờ xác nhận", statuses: ["pending"] },
  { key: "processing", label: "Đang xử lý", statuses: ["accepted", "preparing", "ready"] },
  { key: "completed", label: "Hoàn tất", statuses: ["completed"] },
  { key: "cancelled", label: "Đã huỷ", statuses: ["rejected", "cancelled"] },
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login?next=/orders");

  const orders = await listForCustomer(supabase, userId);
  // Same "missing table/row degrades gracefully" resilience posture as the
  // order detail page's own net-zero lookup — a hiccup here shouldn't break
  // the whole order list.
  const netZeroByOrder = await getImpactForOrders(
    supabase,
    orders.map((o) => o.id)
  ).catch(() => new Map());
  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0];
  const filteredOrders = activeTab.statuses
    ? orders.filter((o) => activeTab.statuses!.includes(o.status))
    : orders;

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-bold">Đơn hàng của tôi</h1>

      <div className="flex flex-wrap gap-1.5 border-b pb-3">
        {TABS.map((t) => {
          const count = t.statuses ? orders.filter((o) => t.statuses!.includes(o.status)).length : orders.length;
          return (
            <Link
              key={t.key}
              href={t.key === "all" ? "/orders" : `/orders?tab=${t.key}`}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                activeTab.key === t.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input text-muted-foreground hover:border-primary hover:text-primary"
              }`}
            >
              {t.label}
              {count > 0 && <span className="ml-1 opacity-80">({count})</span>}
            </Link>
          );
        })}
      </div>

      {filteredOrders.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">
          {orders.length === 0 ? "Bạn chưa có đơn hàng nào." : "Không có đơn hàng nào trong mục này."}
        </p>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const impact = netZeroByOrder.get(order.id);
            return (
              <Link key={order.id} href={`/orders/${order.id}`} className="block">
                <Card className="transition-shadow hover:shadow-md">
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-base">{order.storeName}</CardTitle>
                      <p className="text-xs font-mono text-muted-foreground">
                        Mã đơn: #{order.id.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {order.items.length} món · {order.totalAmount.toLocaleString("vi-VN")}đ ·{" "}
                        {new Date(order.createdAt).toLocaleString("vi-VN")}
                      </p>
                      {impact && (
                        <p className="mt-1 flex items-center gap-1 text-sm font-medium text-primary">
                          <Leaf className="size-3.5" />+{impact.pointsEarned} điểm Net Zero
                          {impact.co2SavedKg > 0 && ` · -${impact.co2SavedKg.toFixed(1)}kg CO2`}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary">{STATUS_LABEL[order.status]}</Badge>
                  </CardHeader>
                  <CardFooter className="justify-end gap-1 text-sm font-medium text-muted-foreground">
                    Xem chi tiết đơn hàng
                    <ChevronRight className="size-4" />
                  </CardFooter>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
