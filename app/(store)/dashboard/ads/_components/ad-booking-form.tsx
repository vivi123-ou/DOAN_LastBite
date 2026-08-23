"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdBannerUploader } from "@/app/(store)/dashboard/ads/_components/ad-banner-uploader";
import {
  initiateMomoAdPaymentAction,
  initiateVnpayAdPaymentAction,
  type BookAdInput,
} from "@/app/(store)/dashboard/ads/actions";
import type { AdPlacementType } from "@/lib/domain/ad";

interface AdBookingFormProps {
  storeId: string;
  placementTypes: AdPlacementType[];
  combos: { id: string; name: string }[];
}

const NEEDS_COMBO: AdPlacementType["key"][] = ["hot_deal", "search_top", "category_top"];

// One form covering all five placement products, adapting its fields to
// whichever type is selected — a combo picker for the three combo-level
// boosts, a banner uploader + link for homepage_banner, nothing extra for
// diamond_partner (store-level, admin reviews manually). Same "pick a tile,
// redirect to the real gateway" payment shape as
// dashboard/subscription/_components/plan-payment-button.tsx.
export function AdBookingForm({ storeId: storeId, placementTypes, combos }: AdBookingFormProps) {
  const [typeId, setTypeId] = useState(placementTypes[0]?.id ?? "");
  const [comboId, setComboId] = useState("");
  const [radiusM, setRadiusM] = useState("5000");
  const [bannerImageUrl, setBannerImageUrl] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [method, setMethod] = useState<"momo" | "vnpay">("momo");
  const [paying, setPaying] = useState(false);

  const selectedType = placementTypes.find((t) => t.id === typeId) ?? null;
  const needsCombo = selectedType ? NEEDS_COMBO.includes(selectedType.key) : false;
  const isBanner = selectedType?.key === "homepage_banner";
  const isDiamond = selectedType?.key === "diamond_partner";

  async function handlePay() {
    if (!selectedType) return;
    if (needsCombo && !comboId) {
      toast.error("Vui lòng chọn combo muốn quảng cáo.");
      return;
    }
    if (isBanner && !bannerImageUrl) {
      toast.error("Vui lòng tải ảnh banner trước.");
      return;
    }

    // Real money, real gateway redirect, not reversible from inside this
    // app once completed — same final confirm step as
    // plan-payment-button.tsx, direct answer to "lỡ bấm nhầm là mất tiền".
    if (
      !window.confirm(
        `Xác nhận thanh toán ${selectedType.price.toLocaleString("vi-VN")}đ cho "${selectedType.name}" qua ${
          method === "momo" ? "MoMo" : "VNPAY"
        }?`
      )
    ) {
      return;
    }

    const input: BookAdInput = {
      placementTypeId: selectedType.id,
      comboId: needsCombo ? comboId : undefined,
      radiusM: selectedType.key === "search_top" ? Number(radiusM) : undefined,
      bannerImageUrl: isBanner ? (bannerImageUrl ?? undefined) : undefined,
      linkUrl: isBanner ? linkUrl || undefined : undefined,
    };

    setPaying(true);
    try {
      const { payUrl } =
        method === "momo" ? await initiateMomoAdPaymentAction(input) : await initiateVnpayAdPaymentAction(input);
      window.location.href = payUrl;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra.");
      setPaying(false);
    }
  }

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="space-y-1.5">
        <Label htmlFor="ad-type">Loại quảng cáo</Label>
        <select
          id="ad-type"
          value={typeId}
          onChange={(e) => setTypeId(e.target.value)}
          className="block w-full rounded-md border bg-background px-2.5 py-1.5 text-sm"
        >
          {placementTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} · {t.price.toLocaleString("vi-VN")}đ / {t.durationDays} ngày
            </option>
          ))}
        </select>
        {selectedType?.description && (
          <p className="text-xs text-muted-foreground">{selectedType.description}</p>
        )}
      </div>

      {needsCombo && (
        <div className="space-y-1.5">
          <Label htmlFor="ad-combo">Combo muốn quảng cáo</Label>
          <select
            id="ad-combo"
            value={comboId}
            onChange={(e) => setComboId(e.target.value)}
            className="block w-full rounded-md border bg-background px-2.5 py-1.5 text-sm"
          >
            <option value="">Chọn combo</option>
            {combos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedType?.key === "search_top" && (
        <div className="space-y-1.5">
          <Label htmlFor="ad-radius">Bán kính khu vực (mét)</Label>
          <Input
            id="ad-radius"
            type="number"
            min={1000}
            max={20000}
            step={1000}
            value={radiusM}
            onChange={(e) => setRadiusM(e.target.value)}
            className="w-40"
          />
          <p className="text-xs text-muted-foreground">
            Chỉ để ghi nhận bạn đã chọn phạm vi nào. Combo vẫn chỉ hiển thị đầu danh sách trong đúng
            phạm vi khách đang tìm kiếm.
          </p>
        </div>
      )}

      {isBanner && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Ảnh banner</Label>
            <AdBannerUploader storeId={storeId} value={bannerImageUrl} onChange={setBannerImageUrl} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ad-link">Liên kết khi bấm vào banner (tuỳ chọn)</Label>
            <Input
              id="ad-link"
              placeholder="/combos/... hoặc để trống"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
          </div>
        </div>
      )}

      {isDiamond && (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Huy hiệu Đối tác Kim Cương hiển thị ở cấp cửa hàng. Admin sẽ xem xét thủ công nếu khu vực
          của bạn đã có đối tác khác đang hoạt động.
        </p>
      )}

      <div className="space-y-2 border-t pt-3">
        <Label>Thanh toán</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMethod("momo")}
            className={`flex h-10 items-center justify-center rounded-md border-2 text-sm font-bold text-white transition-all ${
              method === "momo" ? "border-foreground" : "border-transparent opacity-60"
            } bg-[#a50064]`}
          >
            MoMo
          </button>
          <button
            type="button"
            onClick={() => setMethod("vnpay")}
            className={`flex h-10 items-center justify-center rounded-md border-2 text-sm font-bold text-white transition-all ${
              method === "vnpay" ? "border-foreground" : "border-transparent opacity-60"
            } bg-[#005baa]`}
          >
            VNPAY
          </button>
        </div>
        <Button disabled={paying || !selectedType} onClick={handlePay} className="w-full">
          {paying ? "Đang chuyển hướng..." : "Thanh toán"}
        </Button>
      </div>
    </div>
  );
}
