"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Leaf, MapPin, Minus, Plus, ShoppingCart, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCart } from "@/lib/cart/cart-context";
import { getCurrentPosition, type Coordinates } from "@/lib/geo/geolocation";
import { createOrderAction } from "@/app/(customer)/cart/actions";
import { calculateRedemptionValue, VND_PER_POINT } from "@/lib/pricing/net-zero/net-zero.policy";
import type { GroupOrderInvite } from "@/lib/domain/social";

interface CartViewProps {
  isLoggedIn: boolean;
  netZeroPointsBalance: number;
  groupOrderId?: string;
  // Display-only — see cart/page.tsx. Never null-checked for the actual
  // discount; createOrderAction resolves that fresh server-side regardless.
  groupOrderInvite?: GroupOrderInvite | null;
}

// Two-column layout (items left, order summary + checkout right) — the
// inbook.vn reference (.claude/rules/workflow.md) this replaces a single-
// column stack with. The old "Ưu đãi" slot in that reference becomes
// "Áp dụng điểm Net Zero" here — a real discount source (net-zero.policy.ts)
// instead of a generic promo code box that had nothing behind it.
export function CartView({
  isLoggedIn,
  netZeroPointsBalance,
  groupOrderId,
  groupOrderInvite,
}: CartViewProps) {
  const router = useRouter();
  const cart = useCart();
  const [fulfillmentType, setFulfillmentType] = useState<"pickup" | "delivery">("pickup");
  const [addressLine, setAddressLine] = useState("");
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  // null = "tự động dùng tối đa" (the default — per explicit feedback,
  // Net Zero points should apply optimally without the customer having to
  // remember to click "Dùng tối đa" themselves). A number means the
  // customer manually typed a smaller amount, which sticks until they
  // clear the field or press "Dùng tối đa" again.
  const [manualPoints, setManualPoints] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (cart.items.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <ShoppingCart className="mx-auto mb-3 size-12 text-muted-foreground/40" />
        <p>Giỏ hàng của bạn đang trống.</p>
        <Button variant="link" nativeButton={false} render={<Link href="/">Về trang chủ tìm combo</Link>} />
      </div>
    );
  }

  const canPickup = cart.items.every((i) => i.pickupSupported);
  const canDeliver = cart.items.every((i) => i.deliverySupported);
  const effectiveType = fulfillmentType === "pickup" && !canPickup ? "delivery" : fulfillmentType;

  // Bulk-discount (group-buy) — display-only here, computed the same way
  // cart/actions.ts's createOrderAction resolves it fresh server-side at
  // submit time (group-buy.repository.ts's resolveCheckoutDiscount()), so
  // what's shown here matches what's actually charged.
  const bulkDiscountPct = groupOrderInvite?.currentTier?.discountPct ?? 0;
  const bulkDiscountAmount = Math.round((cart.subtotal * bulkDiscountPct) / 100);
  const subtotalAfterBulkDiscount = cart.subtotal - bulkDiscountAmount;

  const maxRedeemablePoints = Math.min(
    netZeroPointsBalance,
    Math.floor(subtotalAfterBulkDiscount / VND_PER_POINT)
  );
  const clampedPoints = Math.min(manualPoints ?? maxRedeemablePoints, maxRedeemablePoints);
  const pointsDiscount = calculateRedemptionValue(clampedPoints);
  const total = subtotalAfterBulkDiscount - pointsDiscount;

  function handlePointsInput(value: string) {
    if (value === "") {
      setManualPoints(0);
      return;
    }
    const n = Math.max(0, Math.floor(Number(value) || 0));
    setManualPoints(Math.min(n, maxRedeemablePoints));
  }

  async function handleLocate() {
    setLocating(true);
    setError(null);
    try {
      setCoords(await getCurrentPosition());
    } catch {
      setError("Không lấy được vị trí GPS. Vui lòng cho phép quyền định vị và thử lại.");
    } finally {
      setLocating(false);
    }
  }

  async function handleCheckout() {
    setError(null);
    if (effectiveType === "delivery" && (!addressLine || !coords)) {
      setError("Vui lòng nhập địa chỉ và lấy vị trí giao hàng.");
      return;
    }
    setSubmitting(true);
    try {
      const { orderId } = await createOrderAction({
        storeId: cart.storeId,
        fulfillmentType: effectiveType,
        deliveryAddressLine: effectiveType === "delivery" ? addressLine : undefined,
        deliveryLat: effectiveType === "delivery" ? coords?.lat : undefined,
        deliveryLng: effectiveType === "delivery" ? coords?.lng : undefined,
        items: cart.items.map((i) => ({ comboId: i.comboId, quantity: i.quantity })),
        netZeroPointsToApply: clampedPoints,
        groupOrderId,
      });
      cart.clear();
      toast.success("Đặt hàng thành công!");
      router.push(`/orders/${orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {groupOrderId && (
        <div className="flex items-start gap-2.5 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
          <Users className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Đặt hàng theo nhóm mua chung</p>
            {groupOrderInvite ? (
              <p className="text-primary/80">
                Cả nhóm đang có {groupOrderInvite.totalQuantity} phần
                {groupOrderInvite.currentTier
                  ? ` — đang được giảm ${groupOrderInvite.currentTier.discountPct}%, tự động áp vào đơn này.`
                  : groupOrderInvite.nextTier
                    ? ` — cần thêm ${groupOrderInvite.nextTier.minQuantity - groupOrderInvite.totalQuantity} phần nữa để được giảm ${groupOrderInvite.nextTier.discountPct}%.`
                    : "."}
              </p>
            ) : (
              <p className="text-primary/80">Không tìm thấy lời mời này, hoặc lời mời đã hết hạn.</p>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader>
          <CardTitle>{cart.storeName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {cart.items.map((item) => (
            <div key={item.comboId} className="flex items-center gap-4 rounded-md border p-4">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
                <img src={item.imageUrl} alt="" className="size-16 shrink-0 rounded-md border object-cover" />
              ) : (
                <div className="size-16 shrink-0 rounded-md border bg-muted" />
              )}
              <div className="flex-1">
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-muted-foreground">
                  {item.unitPrice.toLocaleString("vi-VN")}đ / combo
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => cart.updateQuantity(item.comboId, item.quantity - 1)}
                >
                  <Minus className="size-3.5" />
                </Button>
                <span className="w-6 text-center">{item.quantity}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => cart.updateQuantity(item.comboId, item.quantity + 1)}
                >
                  <Plus className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => cart.removeItem(item.comboId)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin đơn hàng</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoggedIn && (
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Leaf className="size-4" />
                  Áp dụng điểm Net Zero
                </div>
                {netZeroPointsBalance === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Bạn chưa có điểm Net Zero. Mua hàng để tích điểm nhé!
                  </p>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={maxRedeemablePoints}
                        value={clampedPoints}
                        onChange={(e) => handlePointsInput(e.target.value)}
                        placeholder="0"
                        className="w-24"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setManualPoints(null)}
                        disabled={manualPoints === null}
                      >
                        Dùng tối đa
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Tự động áp dụng số điểm tối ưu nhất — bạn có{" "}
                      <strong>{netZeroPointsBalance.toLocaleString("vi-VN")}</strong> điểm khả dụng (
                      {(netZeroPointsBalance * VND_PER_POINT).toLocaleString("vi-VN")}đ) — 1 điểm Net
                      Zero = {VND_PER_POINT.toLocaleString("vi-VN")}đ.
                    </p>
                  </>
                )}
              </div>
            )}

            <div className="space-y-1.5 border-t pt-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tạm tính</span>
                <span>{cart.subtotal.toLocaleString("vi-VN")}đ</span>
              </div>
              {bulkDiscountAmount > 0 && (
                <div className="flex items-center justify-between text-primary">
                  <span>Giảm giá mua chung (-{bulkDiscountPct}%)</span>
                  <span>-{bulkDiscountAmount.toLocaleString("vi-VN")}đ</span>
                </div>
              )}
              {pointsDiscount > 0 && (
                <div className="flex items-center justify-between text-primary">
                  <span>Giảm giá (điểm Net Zero)</span>
                  <span>-{pointsDiscount.toLocaleString("vi-VN")}đ</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t pt-1.5 text-base font-semibold">
                <span>Tổng cộng</span>
                <span className="text-primary">{total.toLocaleString("vi-VN")}đ</span>
              </div>
            </div>

            {!isLoggedIn ? (
              <div className="rounded-md border bg-muted p-3 text-center text-sm">
                Bạn cần đăng nhập để đặt hàng.{" "}
                <Link href="/login?next=/cart" className="font-medium text-primary hover:underline">
                  Đăng nhập
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Hình thức nhận hàng</Label>
                  <div className="flex gap-2">
                    {canPickup && (
                      <Button
                        type="button"
                        variant={effectiveType === "pickup" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFulfillmentType("pickup")}
                      >
                        Tự đến lấy
                      </Button>
                    )}
                    {canDeliver && (
                      <Button
                        type="button"
                        variant={effectiveType === "delivery" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFulfillmentType("delivery")}
                      >
                        Giao hàng
                      </Button>
                    )}
                  </div>
                  {!canPickup && !canDeliver && (
                    <p className="text-sm text-destructive">
                      Các combo trong giỏ không có hình thức nhận hàng chung — vui lòng bớt món.
                    </p>
                  )}
                </div>

                {effectiveType === "delivery" && (
                  <div className="space-y-2">
                    <Label htmlFor="delivery-address">Địa chỉ giao hàng</Label>
                    <Input
                      id="delivery-address"
                      value={addressLine}
                      onChange={(e) => setAddressLine(e.target.value)}
                      placeholder="Số nhà, đường, quận, thành phố"
                    />
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleLocate}
                        disabled={locating}
                      >
                        <MapPin className="mr-2 size-4" />
                        {locating ? "Đang lấy vị trí..." : "Lấy vị trí hiện tại"}
                      </Button>
                      {coords && (
                        <span className="text-sm text-muted-foreground">
                          {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button
                  className="w-full"
                  onClick={handleCheckout}
                  disabled={submitting || (!canPickup && !canDeliver)}
                >
                  {submitting ? "Đang đặt hàng..." : "Đặt hàng"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
