import Link from "next/link";
import { Clock, ImageOff, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export function ComboCard({ combo }: { combo: NearbyCombo }) {
  const discountPct = Math.round(
    (1 - combo.currentPrice / Math.max(combo.originalPrice, 1)) * 100
  );

  return (
    <Link href={`/combos/${combo.comboId}`}>
      <Card className="h-full gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md">
        <div className="relative aspect-square w-full bg-muted">
          {combo.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
            <img src={combo.imageUrl} alt={combo.name} className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <ImageOff className="size-8" />
            </div>
          )}
          {discountPct > 0 && (
            <Badge className="absolute left-2 top-2 shadow-sm">-{discountPct}%</Badge>
          )}
        </div>
        <CardContent className="flex flex-col gap-2 p-4">
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
      </Card>
    </Link>
  );
}
