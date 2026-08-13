import { notFound, redirect } from "next/navigation";
import { toDataURL } from "qrcode";
import { CheckCircle2, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getById, listStatusHistory } from "@/lib/repositories/order.repository";
import { listForOrder } from "@/lib/repositories/review.repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OrderStatusTimeline } from "@/components/order/order-status-timeline";
import { SimulatePaymentButton } from "@/app/(customer)/orders/[id]/_components/simulate-payment-button";
import { ReviewForm } from "@/app/(customer)/orders/[id]/_components/review-form";

const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ xác nhận",
  accepted: "Đã xác nhận",
  rejected: "Đã từ chối",
  preparing: "Đang chuẩn bị",
  ready: "Sẵn sàng",
  completed: "Hoàn tất",
  cancelled: "Đã huỷ",
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect(`/login?next=/orders/${id}`);

  const order = await getById(supabase, id);
  if (!order || order.customerId !== userId) notFound();

  // Same "missing table, not just a missing column" resilience exception
  // as combos/[id]/page.tsx — this page's core job (order status, QR code)
  // shouldn't 500 just because the review add-on can't load yet.
  const reviews =
    order.status === "completed" ? await listForOrder(supabase, order.id).catch(() => []) : [];
  const reviewByOrderItem = new Map(reviews.map((r) => [r.orderItemId, r]));

  // Same resilience exception as the reviews fetch above — order_status_history
  // (0023) is a new table, and a missing *table* fails the whole query
  // (unlike a missing column), so this degrades to an empty timeline rather
  // than 500ing this page.
  const statusHistory = await listStatusHistory(supabase, order.id).catch(() => []);

  const isPaid = order.paymentStatus === "success";
  let qrDataUrl: string | null = null;
  if (isPaid && order.fulfillmentType === "pickup" && order.qrCodeToken) {
    // Generated server-side, only after payments.status = 'success' — see
    // .claude/rules/business-rules.md "QR code timing".
    qrDataUrl = await toDataURL(order.qrCodeToken, { width: 240 });
  }

  const orderCode = order.id.slice(0, 8).toUpperCase();
  // Not shown once the order is over (completed/rejected/cancelled) — "đã
  // gửi đến cửa hàng" stops being the relevant framing by then, the status
  // badge already tells that part of the story.
  const showSentBanner = !["completed", "rejected", "cancelled"].includes(order.status);

  // discountAmount on the order is the *combined* bulk + Net Zero discount
  // (order.builder.ts applies bulk first, then points on what's left) — the
  // breakdown shown here re-derives each half from bulk_discount_pct /
  // net_zero_points_used rather than needing two separate stored columns,
  // same "compute for display, don't store twice" spirit as the dynamic
  // pricing strategy elsewhere in this app.
  const bulkDiscountAmount = Math.round((order.subtotal * order.bulkDiscountPct) / 100);
  const netZeroDiscountAmount = order.discountAmount - bulkDiscountAmount;

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-8">
      {showSentBanner && (
        <div className="flex items-center gap-2.5 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
          <CheckCircle2 className="size-5 shrink-0" />
          <span>Đặt hàng thành công! Đơn hàng của bạn đã được gửi đến cửa hàng.</span>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{order.storeName}</h1>
          <p className="text-sm font-mono text-muted-foreground">Mã đơn hàng: #{orderCode}</p>
          <p className="text-sm text-muted-foreground">
            {new Date(order.createdAt).toLocaleString("vi-VN")}
          </p>
        </div>
        <Badge variant="secondary">{STATUS_LABEL[order.status]}</Badge>
      </div>

      {/* Biên lai — real item lines + a real price breakdown, not just a
          single total, so a bulk-discount (group-buy) or Net Zero
          redemption is actually visible on the order that used it, not
          just silently folded into one number. */}
      <Card>
        <CardContent className="space-y-3 p-4">
          {order.items.map((item) => (
            <div key={item.id} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>
                  {item.comboName} x{item.quantity}
                </span>
                <span>{item.subtotal.toLocaleString("vi-VN")}đ</span>
              </div>
              {order.status === "completed" && (
                <ReviewForm
                  orderId={order.id}
                  orderItemId={item.id}
                  comboName={item.comboName}
                  existingReview={reviewByOrderItem.get(item.id) ?? null}
                />
              )}
            </div>
          ))}

          <div className="space-y-1.5 border-t pt-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Tạm tính</span>
              <span>{order.subtotal.toLocaleString("vi-VN")}đ</span>
            </div>
            {bulkDiscountAmount > 0 && (
              <div className="flex justify-between text-primary">
                <span>Giảm giá mua chung (-{order.bulkDiscountPct}%)</span>
                <span>-{bulkDiscountAmount.toLocaleString("vi-VN")}đ</span>
              </div>
            )}
            {netZeroDiscountAmount > 0 && (
              <div className="flex justify-between text-primary">
                <span>Điểm Net Zero (-{order.netZeroPointsUsed} điểm)</span>
                <span>-{netZeroDiscountAmount.toLocaleString("vi-VN")}đ</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-1.5 text-base font-semibold">
              <span>Tổng cộng</span>
              <span className="text-primary">{order.totalAmount.toLocaleString("vi-VN")}đ</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {statusHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trạng thái đơn hàng</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderStatusTimeline events={statusHistory} />
          </CardContent>
        </Card>
      )}

      <div className="rounded-md border p-4 text-sm">
        <p>
          Hình thức nhận hàng:{" "}
          <strong>{order.fulfillmentType === "pickup" ? "Tự đến lấy" : "Giao hàng"}</strong>
        </p>
        {order.fulfillmentType === "delivery" && order.deliveryAddressLine && (
          <p className="text-muted-foreground">Địa chỉ: {order.deliveryAddressLine}</p>
        )}
      </div>

      {!isPaid && <SimulatePaymentButton orderId={order.id} />}

      {isPaid && order.fulfillmentType === "pickup" && qrDataUrl && (
        <div className="flex flex-col items-center gap-3 rounded-md border p-6">
          <p className="text-sm text-muted-foreground">Đưa mã này cho cửa hàng khi đến lấy</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- server-generated data URI, next/image doesn't apply */}
          <img src={qrDataUrl} alt="Mã QR nhận hàng" className="size-60" />
          {/* A data: URI download works with a plain <a download> — no
              upload/storage round trip needed, the image is already fully
              client-side. */}
          <a
            href={qrDataUrl}
            download={`lastbite-qr-${orderCode}.png`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <Download className="size-4" />
            Lưu ảnh QR về máy
          </a>
        </div>
      )}

      {isPaid && order.fulfillmentType === "delivery" && (
        <div className="rounded-md border p-4 text-sm">
          <p className="text-muted-foreground">
            Trạng thái giao hàng: <strong>{STATUS_LABEL[order.status]}</strong>
          </p>
        </div>
      )}
    </div>
  );
}
