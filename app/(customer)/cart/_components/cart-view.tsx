"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MapPin, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useCart } from "@/lib/cart/cart-context";
import { getCurrentPosition, type Coordinates } from "@/lib/geo/geolocation";
import { createOrderAction } from "@/app/(customer)/cart/actions";

export function CartView({ isLoggedIn }: { isLoggedIn: boolean }) {
  const router = useRouter();
  const cart = useCart();
  const [fulfillmentType, setFulfillmentType] = useState<"pickup" | "delivery">("pickup");
  const [addressLine, setAddressLine] = useState("");
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (cart.items.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <p>Giỏ hàng của bạn đang trống.</p>
        <Button variant="link" nativeButton={false} render={<Link href="/">Về trang chủ tìm combo</Link>} />
      </div>
    );
  }

  const canPickup = cart.items.every((i) => i.pickupSupported);
  const canDeliver = cart.items.every((i) => i.deliverySupported);
  const effectiveType = fulfillmentType === "pickup" && !canPickup ? "delivery" : fulfillmentType;

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
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="font-semibold">{cart.storeName}</h2>
        {cart.items.map((item) => (
          <Card key={item.comboId}>
            <CardContent className="flex items-center gap-4 p-4">
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
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between border-t pt-4 text-lg font-semibold">
        <span>Tổng cộng</span>
        <span className="text-primary">{cart.subtotal.toLocaleString("vi-VN")}đ</span>
      </div>

      {!isLoggedIn ? (
        <div className="rounded-md border bg-muted p-4 text-center text-sm">
          Bạn cần đăng nhập để đặt hàng.{" "}
          <Link href="/login?next=/cart" className="font-medium text-primary hover:underline">
            Đăng nhập
          </Link>
        </div>
      ) : (
        <div className="space-y-4 rounded-md border p-4">
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
                <Button type="button" variant="outline" size="sm" onClick={handleLocate} disabled={locating}>
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
    </div>
  );
}
