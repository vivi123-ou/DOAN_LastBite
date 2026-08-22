import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, MapPin, Package, Sparkles, Star, Store as StoreIcon, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getById } from "@/lib/repositories/combo.repository";
import { getById as getProfileById } from "@/lib/repositories/profile.repository";
import { getComboRatingSummary, listPublicForCombo } from "@/lib/repositories/review.repository";
import { getEffectiveSubscription } from "@/lib/repositories/subscription.repository";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { ShareGroupBuyButton } from "@/components/combo/share-group-buy-button";

const STATUS_MESSAGE: Record<string, string> = {
  locked: "Combo này đã quá hạn Best Before và không còn được bán.",
  sold_out: "Combo này đã hết hàng.",
  paused: "Cửa hàng đang tạm ngưng bán combo này.",
  draft: "Combo này chưa được mở bán.",
};

export default async function ComboDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ groupOrderId?: string }>;
}) {
  const { id } = await params;
  const { groupOrderId } = await searchParams;
  const supabase = await createClient();
  const [combo, userId] = await Promise.all([getById(supabase, id), getCurrentUserId(supabase)]);

  if (!combo) notFound();

  // Unlike most other "pending migration" spots in this app, a missing
  // column just comes back undefined — a missing *table* fails the whole
  // query, and this page is core purchasing flow (the only entry point
  // into the cart). Swallowed here specifically so an unapplied
  // 0015_combo_reviews.sql degrades to "no rating shown yet" instead of a
  // hard 500 that would block buying anything sitewide — everywhere else
  // in this app that surfaces the real error on purpose, this one page is
  // the deliberate exception.
  // isPremiumStore: same resilience posture as ratingSummary/reviews above —
  // a subscription-lookup hiccup shouldn't block the one entry point into
  // the cart. Cheap, read-only check purely for the "Đối tác Premium" badge.
  const [ratingSummary, reviews, isPremiumStore] = await Promise.all([
    getComboRatingSummary(supabase, combo.id).catch(() => ({ averageRating: 0, reviewCount: 0 })),
    listPublicForCombo(supabase, combo.id).catch(() => []),
    getEffectiveSubscription(createAdminClient(), combo.storeId)
      .then((e) => e.tier === "premium")
      .catch(() => false),
  ]);

  const discountPct = Math.round(
    (1 - combo.currentPrice / Math.max(combo.originalPrice, 1)) * 100
  );
  // A store can't buy from itself — see the "kênh bán / kênh mua" decision
  // in CLAUDE.md §7. This is the one entry point into the cart, so gating
  // it here is sufficient; createOrderAction also rejects it server-side
  // as defense-in-depth in case a stale cart slips through.
  const isOwnStore = userId !== null && userId === combo.storeOwnerId;
  // role='admin' is a "pure staff" account per the explicit product
  // decision — no shopping, same treatment as isOwnStore above.
  const viewerProfile = userId ? await getProfileById(supabase, userId) : null;
  const isAdmin = viewerProfile?.role === "admin";
  const isBuyable = combo.status === "active" && !isOwnStore && !isAdmin;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      {groupOrderId && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
          Bạn đang mua theo lời mời mua chung. Thêm vào giỏ hàng để tiếp tục.
        </div>
      )}

      {/* Real photos of this exact combo — never a "mystery bag". */}
      {combo.images.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {combo.images.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
            <img
              key={url}
              src={url}
              alt={combo.name}
              className="aspect-square w-full rounded-lg border object-cover"
            />
          ))}
        </div>
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground">
          Cửa hàng chưa đăng ảnh cho combo này
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold">{combo.name}</h1>
          {discountPct > 0 && <Badge className="shrink-0">-{discountPct}%</Badge>}
        </div>
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-4" />
          {combo.storeName} · {combo.storeAddressLine}
          {isPremiumStore && (
            <Badge variant="outline" className="gap-1 text-primary">
              <Sparkles className="size-3" />
              Đối tác Premium
            </Badge>
          )}
        </p>
        {ratingSummary.reviewCount > 0 && (
          <p className="flex items-center gap-1 text-sm">
            <Star className="size-4 fill-primary text-primary" />
            <strong>{ratingSummary.averageRating.toFixed(1)}</strong>
            <span className="text-muted-foreground">({ratingSummary.reviewCount} đánh giá)</span>
          </p>
        )}
      </div>

      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-bold text-primary">
          {combo.currentPrice.toLocaleString("vi-VN")}đ
        </span>
        {discountPct > 0 && (
          <span className="text-muted-foreground line-through">
            {combo.originalPrice.toLocaleString("vi-VN")}đ
          </span>
        )}
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="size-4 text-primary" />
            <span>
              Best Before:{" "}
              <strong>{new Date(combo.bestBefore).toLocaleString("vi-VN")}</strong>
            </span>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {combo.pickupSupported && (
              <Badge variant="secondary">
                <Package className="mr-1 size-3" />
                Tự đến lấy
              </Badge>
            )}
            {combo.deliverySupported && (
              <Badge variant="secondary">
                <Truck className="mr-1 size-3" />
                Giao hàng
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="font-semibold">Nội dung combo</h2>
        <ul className="space-y-1 rounded-lg border p-4 text-sm">
          {combo.items.map((item) => (
            <li key={item.id} className="flex justify-between">
              <span>{item.itemName}</span>
              <span className="text-muted-foreground">x{item.quantity}</span>
            </li>
          ))}
        </ul>
        {combo.description && <p className="text-sm text-muted-foreground">{combo.description}</p>}
      </div>

      {isOwnStore && combo.status === "active" && (
        <div className="flex items-center justify-between gap-4 rounded-md border border-dashed p-4 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <StoreIcon className="size-4" />
            Đây là combo của cửa hàng bạn. Không thể tự mua.
          </span>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/dashboard/combos/${combo.id}/edit`}>Chỉnh sửa</Link>}
          />
        </div>
      )}
      {isAdmin && !isOwnStore && combo.status === "active" && (
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          Tài khoản quản trị không thể mua hàng.
        </p>
      )}
      {!isBuyable && !isOwnStore && !isAdmin && (
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          {STATUS_MESSAGE[combo.status] ?? "Combo này hiện không thể mua."}
        </p>
      )}
      {isBuyable && combo.remainingStock <= 0 && (
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          Combo này đã hết hàng.
        </p>
      )}
      {isBuyable && combo.remainingStock > 0 && (
        <div className="flex gap-2">
          <AddToCartButton
            item={{
              comboId: combo.id,
              storeId: combo.storeId,
              storeName: combo.storeName,
              name: combo.name,
              unitPrice: combo.currentPrice,
              imageUrl: combo.images[0] ?? null,
              deliverySupported: combo.deliverySupported,
              pickupSupported: combo.pickupSupported,
            }}
            groupOrderId={groupOrderId}
          />
          {userId && !groupOrderId && (
            <ShareGroupBuyButton storeId={combo.storeId} comboId={combo.id} />
          )}
        </div>
      )}

      {reviews.length > 0 && (
        <div className="space-y-3 border-t pt-6">
          <h2 className="font-semibold">Đánh giá từ khách hàng</h2>
          <div className="space-y-3">
            {reviews.map((review) => (
              <div key={review.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        className={`size-3.5 ${i < (review.rating ?? 0) ? "fill-primary text-primary" : "text-muted-foreground"}`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {review.customerName ?? "Khách hàng"} ·{" "}
                    {new Date(review.createdAt).toLocaleDateString("vi-VN")}
                  </span>
                </div>
                {review.comment && <p className="mt-1 text-muted-foreground">{review.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
