import { notFound } from "next/navigation";
import { Clock, MapPin, Package, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getById } from "@/lib/repositories/combo.repository";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const STATUS_MESSAGE: Record<string, string> = {
  locked: "Combo này đã quá hạn Best Before và không còn được bán.",
  sold_out: "Combo này đã hết hàng.",
  paused: "Cửa hàng đang tạm ngưng bán combo này.",
  draft: "Combo này chưa được mở bán.",
};

export default async function ComboDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const combo = await getById(supabase, id);

  if (!combo) notFound();

  const discountPct = Math.round(
    (1 - combo.currentPrice / Math.max(combo.originalPrice, 1)) * 100
  );
  const isBuyable = combo.status === "active";

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
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
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-4" />
          {combo.storeName} · {combo.storeAddressLine}
        </p>
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

      {!isBuyable && (
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          {STATUS_MESSAGE[combo.status] ?? "Combo này hiện không thể mua."}
        </p>
      )}
      {isBuyable && (
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          Giỏ hàng và thanh toán online sẽ có ở giai đoạn tiếp theo của LastBite.
        </p>
      )}
    </div>
  );
}
