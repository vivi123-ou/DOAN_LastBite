import Link from "next/link";
import { Clock, ImageOff, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import type { NearbyCombo } from "@/lib/domain/combo";

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatBestBefore(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return "Đã hết hạn";
  const hours = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  if (hours >= 1) return `Còn ${hours} giờ ${minutes} phút`;
  return `Còn ${minutes} phút`;
}

interface ComboCardProps {
  combo: NearbyCombo;
}

// No contextual "which section is this from" badge on the card itself —
// tried that (inbook.vn's "Bán Chạy" tag was the reference) and it read as
// redundant/buggy-looking wherever the card already sits under its own
// section heading (carousel rows, the search-results list) — the heading
// says it once, the card doesn't need to repeat it.
export function ComboCard({ combo }: ComboCardProps) {
  const discountPct = Math.round(
    (1 - combo.currentPrice / Math.max(combo.originalPrice, 1)) * 100
  );

  return (
    <Card className="h-full gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md">
      <Link href={`/combos/${combo.comboId}`}>
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          {combo.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
            <img
              src={combo.imageUrl}
              alt={combo.name}
              className="size-full object-cover object-center"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <ImageOff className="size-8" />
            </div>
          )}
          {/* Soft fade into the card's own background instead of a hard cut
              from photo to text. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent" />
          {discountPct > 0 && (
            <Badge className="absolute right-2 top-2 shadow-sm">-{discountPct}%</Badge>
          )}
        </div>
        <CardContent className="flex flex-col gap-2 p-4 pb-0">
          <h3 className="font-semibold leading-tight">{combo.name}</h3>
          <p className="text-sm text-muted-foreground">{combo.storeName}</p>

          <div className="space-y-1 pt-1">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-primary">
                {combo.currentPrice.toLocaleString("vi-VN")}đ
              </span>
              {discountPct > 0 && (
                <span className="text-sm text-muted-foreground line-through">
                  {combo.originalPrice.toLocaleString("vi-VN")}đ
                </span>
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" />
                {formatBestBefore(combo.bestBefore)}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" />
                {formatDistance(combo.distanceM)}
              </span>
            </div>
          </div>
        </CardContent>
      </Link>

      {/* Outside the <Link> on purpose — a <button> nested inside an <a>
          both is invalid HTML and would double-fire navigation on click. */}
      <div className="p-4 pt-3">
        <AddToCartButton
          item={{
            comboId: combo.comboId,
            storeId: combo.storeId,
            storeName: combo.storeName,
            name: combo.name,
            unitPrice: combo.currentPrice,
            imageUrl: combo.imageUrl,
            deliverySupported: combo.deliverySupported,
            pickupSupported: combo.pickupSupported,
          }}
        />
      </div>
    </Card>
  );
}
