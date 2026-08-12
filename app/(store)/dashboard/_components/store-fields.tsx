"use client";

import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Coordinates } from "@/lib/geo/geolocation";

interface StoreFieldsProps {
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  addressLine: string;
  onAddressLineChange: (value: string) => void;
  coords: Coordinates | null;
  onLocate: () => void;
  locating: boolean;
}

// Shared field set between the store registration form
// (store-registration-form.tsx) and the store-info edit form
// (dashboard/store/_components/store-info-form.tsx) — the two forms used
// to diverge, which meant a registered store's info didn't line up with
// what the edit page later asked for. Now both forms render this same
// component and only differ in what happens on submit (create vs. update)
// and whether logo/banner uploaders are shown alongside it (images only
// make sense once a store row exists to upload against).
export function StoreFields({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  addressLine,
  onAddressLineChange,
  coords,
  onLocate,
  locating,
}: StoreFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="store-name">Tên cửa hàng</Label>
        <Input
          id="store-name"
          required
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="store-description">Mô tả (tuỳ chọn)</Label>
        <Textarea
          id="store-description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="store-address">Địa chỉ</Label>
        <Input
          id="store-address"
          required
          value={addressLine}
          onChange={(e) => onAddressLineChange(e.target.value)}
          placeholder="Số nhà, đường, quận, thành phố"
        />
      </div>

      <div className="space-y-2">
        <Label>Vị trí GPS</Label>
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" onClick={onLocate} disabled={locating}>
            <MapPin className="mr-2 size-4" />
            {locating ? "Đang lấy vị trí..." : "Lấy vị trí hiện tại"}
          </Button>
          {coords && (
            <span className="text-sm text-muted-foreground">
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Đứng tại cửa hàng khi bấm nút này để định vị chính xác — vị trí này dùng để hiển thị cửa
          hàng của bạn cho khách gần đó.
        </p>
      </div>
    </>
  );
}
