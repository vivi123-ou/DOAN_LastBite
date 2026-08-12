import { notFound, redirect } from "next/navigation";
import { toDataURL } from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getById } from "@/lib/repositories/order.repository";
import { listForOrder } from "@/lib/repositories/review.repository";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  const isPaid = order.paymentStatus === "success";
  let qrDataUrl: string | null = null;
  if (isPaid && order.fulfillmentType === "pickup" && order.qrCodeToken) {
    // Generated server-side, only after payments.status = 'success' — see
    // .claude/rules/business-rules.md "QR code timing".
    qrDataUrl = await toDataURL(order.qrCodeToken, { width: 240 });
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{order.storeName}</h1>
          <p className="text-sm text-muted-foreground">
            Đơn #{order.id.slice(0, 8)} · {new Date(order.createdAt).toLocaleString("vi-VN")}
          </p>
        </div>
        <Badge variant="secondary">{STATUS_LABEL[order.status]}</Badge>
      </div>

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
          <div className="flex justify-between border-t pt-2 font-semibold">
            <span>Tổng cộng</span>
            <span className="text-primary">{order.totalAmount.toLocaleString("vi-VN")}đ</span>
          </div>
        </CardContent>
      </Card>

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
        <div className="flex flex-col items-center gap-2 rounded-md border p-6">
          <p className="text-sm text-muted-foreground">Đưa mã này cho cửa hàng khi đến lấy</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- server-generated data URI, next/image doesn't apply */}
          <img src={qrDataUrl} alt="Mã QR nhận hàng" className="size-60" />
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
