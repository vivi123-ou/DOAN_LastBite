"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { createTierAction, deleteTierAction } from "@/app/(store)/dashboard/pricing/actions";
import type { BulkDiscountTier } from "@/lib/domain/store";

interface TiersManagerProps {
  storeTiers: BulkDiscountTier[];
  defaultTiers: BulkDiscountTier[];
}

// A store's own tiers, editable inline, plus the platform default shown
// read-only underneath for reference ("here's what you're on if you don't
// configure anything") — not two separate pages, since the whole point is
// comparing the two while deciding.
export function TiersManager({ storeTiers, defaultTiers }: TiersManagerProps) {
  const router = useRouter();
  const [minQuantity, setMinQuantity] = useState("");
  const [discountPct, setDiscountPct] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createTierAction({ minQuantity: Number(minQuantity), discountPct: Number(discountPct) });
      toast.success("Đã thêm mức giảm.");
      setMinQuantity("");
      setDiscountPct("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(tierId: string) {
    if (!window.confirm("Xoá mức giảm giá này? Đơn mua chung đang áp dụng mức này sẽ quay về mức mặc định của hệ thống."))
      return;
    setPendingId(tierId);
    try {
      await deleteTierAction(tierId);
      toast.success("Đã xoá mức giảm.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">Mức giảm của cửa hàng bạn</h2>
          {storeTiers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Chưa cấu hình mức giảm riêng. Cửa hàng đang dùng mức mặc định của hệ thống bên dưới.
            </p>
          ) : (
            <ul className="space-y-2">
              {storeTiers.map((tier) => (
                <li
                  key={tier.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span>
                    Từ <strong>{tier.minQuantity}</strong> phần trở lên: giảm{" "}
                    <strong className="text-primary">{tier.discountPct}%</strong>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={pendingId === tier.id}
                    onClick={() => handleDelete(tier.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2 border-t pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="tier-min-quantity">Từ số lượng</Label>
              <Input
                id="tier-min-quantity"
                type="number"
                min={2}
                required
                className="w-28"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tier-discount-pct">Giảm (%)</Label>
              <Input
                id="tier-discount-pct"
                type="number"
                min={0}
                max={100}
                required
                className="w-28"
                value={discountPct}
                onChange={(e) => setDiscountPct(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Đang thêm..." : "Thêm mức giảm"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="space-y-2 p-4">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Mức mặc định của hệ thống (áp dụng khi bạn chưa cấu hình gì)
          </h2>
          <ul className="space-y-1.5">
            {defaultTiers.map((tier) => (
              <li key={tier.id} className="text-sm text-muted-foreground">
                Từ <strong>{tier.minQuantity}</strong> phần trở lên: giảm{" "}
                <strong>{tier.discountPct}%</strong>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
