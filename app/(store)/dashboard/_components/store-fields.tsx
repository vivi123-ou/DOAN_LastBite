"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Coordinates } from "@/lib/geo/geolocation";

const LocationPickerMap = dynamic(
  () => import("@/components/map/location-picker-map").then((mod) => mod.LocationPickerMap),
  { ssr: false }
);

// Just a display center for the picker map before any real coordinate
// exists yet (Hồ Chí Minh City) — never submitted as-is; onCoordsChange
// only fires from an actual GPS fix, geocode result, or map interaction.
const DEFAULT_CENTER: Coordinates = { lat: 10.7769, lng: 106.7009 };

const GEOCODE_DEBOUNCE_MS = 900;

interface StoreFieldsProps {
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  addressLine: string;
  onAddressLineChange: (value: string) => void;
  coords: Coordinates | null;
  onCoordsChange: (coords: Coordinates) => void;
  onLocate: () => void;
  locating: boolean;
}

// Shared field set between the store registration form
// (store-registration-form.tsx) and the store-info edit form
// (dashboard/store/_components/store-info-form.tsx) — see those files'
// comments for why. Location can be set three ways, per explicit feedback
// ("tự động lấy luôn, hoặc là mình chọn nhập vị trí... giống Google Map"):
// the GPS button (existing), typing the address (debounced auto-geocode
// via /api/geocode → Nominatim), or dragging/clicking the pin on the
// embedded map directly.
export function StoreFields({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  addressLine,
  onAddressLineChange,
  coords,
  onCoordsChange,
  onLocate,
  locating,
}: StoreFieldsProps) {
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeNotice, setGeocodeNotice] = useState<string | null>(null);
  // Seeded with whatever address the field already starts with (empty for
  // registration, the store's saved address when editing) — without this,
  // opening the edit form would auto-fire a geocode lookup on mount and
  // could nudge an already-correct, precisely GPS-captured pin for no
  // reason the owner asked for.
  const lastGeocodedAddress = useRef<string>(addressLine.trim());

  // Debounced: waits for typing to pause before looking the address up, so
  // this doesn't fire a request per keystroke. Only auto-moves the pin when
  // Nominatim actually finds something for the *current* text — typing
  // something unrecognizable just leaves the last good position alone.
  useEffect(() => {
    const trimmed = addressLine.trim();
    if (trimmed.length < 5 || trimmed === lastGeocodedAddress.current) return;

    const timer = setTimeout(() => {
      setGeocoding(true);
      setGeocodeNotice(null);
      fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          lastGeocodedAddress.current = trimmed;
          if (data?.result) {
            onCoordsChange({ lat: data.result.lat, lng: data.result.lng });
            setGeocodeNotice(null);
          } else {
            setGeocodeNotice("Không tìm được toạ độ cho địa chỉ này — kéo ghim trên bản đồ để chỉnh.");
          }
        })
        .catch(() => setGeocodeNotice(null))
        .finally(() => setGeocoding(false));
    }, GEOCODE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [addressLine, onCoordsChange]);

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
        <p className="text-xs text-muted-foreground">
          {geocoding
            ? "Đang tìm toạ độ từ địa chỉ..."
            : geocodeNotice ?? "Toạ độ sẽ tự cập nhật theo địa chỉ bạn nhập."}
        </p>
      </div>

      <div className="space-y-2">
        <Label>Vị trí trên bản đồ</Label>
        <LocationPickerMap coords={coords ?? DEFAULT_CENTER} onChange={onCoordsChange} />
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={onLocate} disabled={locating}>
            <MapPin className="mr-2 size-4" />
            {locating ? "Đang lấy vị trí..." : "Dùng vị trí hiện tại"}
          </Button>
          {coords && (
            <span className="text-sm text-muted-foreground">
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Kéo ghim hoặc bấm vào bản đồ để chỉnh vị trí chính xác — vị trí này dùng để hiển thị cửa
          hàng của bạn cho khách gần đó.
        </p>
      </div>
    </>
  );
}
