import Link from "next/link";
import { Clock, MapPin } from "lucide-react";
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
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardContent className="flex h-full flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-tight">{combo.name}</h3>
            {discountPct > 0 && <Badge className="shrink-0">-{discountPct}%</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{combo.storeName}</p>

          <div className="mt-auto space-y-1 pt-2">
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
